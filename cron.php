<?php
include "backend.php"; // include functions, config, $db

$q=$db->query("SELECT * FROM withdraw_queue WHERE status='pending_auto'");
while($w=$q->fetch_assoc()){
    $user=getUser($w['user_id']);
    $fp=sendFaucetPay($user['faucetpay_email'],$w['amount'],$w['currency'],$user['ip_address']);
    if($fp['status']==200){
        $db->query("UPDATE withdraw_queue SET status='paid', txid='{$fp['transaction_id']}' WHERE id={$w['id']}");
        $db->query("UPDATE users SET balance=0 WHERE id={$w['user_id']}");
        updateFirebase("users/{$w['user_id']}",["balance"=>0]);
    }
}
