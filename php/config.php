<?php
declare(strict_types=1);
session_start();
const DB_HOST='127.0.0.1'; const DB_NAME='cdfs'; const DB_USER='root'; const DB_PASS='';

/* ---------- Analisis AI Job Matching (opsional) ----------
   Isi AI_API_KEY dengan API key Claude (console.anthropic.com) agar ringkasan Job Matching
   ditulis oleh AI. Jika dikosongkan, aplikasi tetap berjalan dengan ringkasan otomatis. */
const AI_API_KEY='';
const AI_MODEL='claude-sonnet-5';
function db(): PDO {
    static $pdo=null; if ($pdo instanceof PDO) return $pdo;
    $pdo=new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',DB_USER,DB_PASS,[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false]);
    return $pdo;
}
function jsonResponse(array $data,int $status=200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data,JSON_UNESCAPED_UNICODE); exit;
}
