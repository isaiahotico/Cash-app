<?php
header("Content-Type: application/json");

// ======================
// 🔹 CONFIG
// ======================
$config = [
    "db"=>["host"=>"localhost","user"=>"root","pass"=>"","name"=>"autofaucet"],
    "faucetpay"=>["api_key"=>"YOUR_FAUCETPAY_API_KEY"],
    "min_withdraw"=>["USDT"=>1,"TRX"=>5,"LTC"=>0.001],
    "auto_limit"=>["USDT"=>2,"TRX"=>20,"LTC"=>0.01],
    "claim_reward"=>["USDT"=>0.01,"TRX"=>0.1,"LTC"=>0.00001],
    "claim_cooldown"=>300,
    "admin_password"=>"Propetas6",
    "firebase_url"=>"https://your-firebase.firebaseio.com/"
];

// ======================
// 🔹 DATABASE
// ======================
$db = new mysqli($config["db"]["host"], $config["db"]["user"], $config["db"]["pass"], $config["db"]["name"]);

// ======================
// 🔹 FUNCTIONS
// ======================
function updateFirebase($path,$data){ global $config;
    $url = $config["firebase_url"].$path.".json";
    $options = ["http"=>["method"=>"PATCH","header"=>"Content-type: application/json","content"=>json_encode($data)]];
    file_get_contents($url,false,stream_context_create($options));
}

function sendFaucetPay($to,$amount,$currency,$ip){ global $config;
    $ch=curl_init("https://faucetpay.io/api/v1/send");
    curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
    curl_setopt($ch,CURLOPT_POST,true);
    curl_setopt($ch,CURLOPT_POSTFIELDS,http_build_query([
        "api_key"=>$config["faucetpay"]["api_key"],
        "to"=>$to,"amount"=>$amount,"currency"=>$currency,"ip_address"=>$ip
    ]));
    $resp=curl_exec($ch); curl_close($ch);
    return json_decode($resp,true);
}

function getUser($userId){ global $db;
    $res=$db->query("SELECT * FROM users WHERE id=$userId");
    return $res->fetch_assoc();
}

function transaction($userId,$callback){ global $db;
    $user=getUser($userId);
    $newData=$callback($user);
    if($newData){
        $set=[];
        foreach($newData as $k=>$v){ $set[]="$k='".$db->real_escape_string($v)."'"; }
        $db->query("UPDATE users SET ".implode(",",$set)." WHERE id=$userId");
        return $newData;
    }
    return null;
}

// ======================
// 🔹 API ENDPOINT
// ======================
$action=$_GET['action']??null;
$userId=intval($_GET['userId']??0);

switch($action){

// ---- CLAIM FAUCET ----
case "claim":
    $currency=$_GET['currency']??'TRX';
    $reward=$config["claim_reward"][$currency];
    $cooldown=$config["claim_cooldown"];

    transaction($userId,function($user) use($reward,$cooldown){
        $now=time();
        if(!$user['lastClaim'] || $now-strtotime($user['lastClaim'])>$cooldown){
            return ["balance"=>($user['balance']??0)+$reward,"lastClaim"=>date("Y-m-d H:i:s")];
        } else { echo json_encode(["error"=>"Cooldown active"]); exit; }
    });

    updateFirebase("users/$userId",["balance"=>getUser($userId)['balance']]);
    echo json_encode(["success"=>"Claimed $reward $currency"]);
    break;

// ---- REQUEST WITHDRAWAL ----
case "request_withdraw":
    $currency=$_GET['currency']??'TRX';
    $user=getUser($userId);
    $amount=floatval($user['balance']);
    if($amount<$config['min_withdraw'][$currency]){ echo json_encode(["error"=>"Minimum withdrawal not reached"]); exit; }
    $status=($amount<=$config['auto_limit'][$currency])?'pending_auto':'pending_manual';
    $db->query("INSERT INTO withdraw_queue (user_id,currency,amount,status) VALUES ($userId,'$currency',$amount,'$status')");
    echo json_encode(["success"=>"Withdrawal requested"]);
    break;

// ---- ADMIN ACTION ----
case "admin_action":
    $password=$_GET['password']??'';
    $wid=intval($_GET['wid']??0);
    $do=$_GET['do']??'approve';
    if($password!=$config['admin_password']){ echo json_encode(["error"=>"Invalid password"]); exit; }
    $wRes=$db->query("SELECT * FROM withdraw_queue WHERE id=$wid"); $withdraw=$wRes->fetch_assoc();
    if(!$withdraw){ echo json_encode(["error"=>"Withdraw not found"]); exit; }
    $user=getUser($withdraw['user_id']);

    if($do==='approve'){
        $fp=sendFaucetPay($user['faucetpay_email'],$withdraw['amount'],$withdraw['currency'],$user['ip_address']);
        if($fp['status']==200){
            $db->query("UPDATE withdraw_queue SET status='paid', txid='{$fp['transaction_id']}' WHERE id=$wid");
            $db->query("UPDATE users SET balance=0 WHERE id={$withdraw['user_id']}");
            updateFirebase("users/{$withdraw['user_id']}",["balance"=>0]);
            echo json_encode(["success"=>"Withdrawal approved"]);
        } else { echo json_encode(["error"=>"FaucetPay error: ".$fp['message']]); }
    } else if($do==='reject'){
        $db->query("UPDATE withdraw_queue SET status='rejected' WHERE id=$wid");
        echo json_encode(["success"=>"Withdrawal rejected"]);
    }
    break;

default:
    echo json_encode(["error"=>"Invalid action"]);
}
