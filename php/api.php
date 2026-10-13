<?php
declare(strict_types=1);
require_once __DIR__.'/config.php';
$action=$_GET['action']??'';
$input=json_decode(file_get_contents('php://input'),true)?:[];

/* Peran yang diizinkan & daftar prodi per jalur (Jobseeker) */
const ROLES=['Jobseeker','Jobprovider'];
const PRODI_BY_JALUR=[
    'Akademis'=>['Matematika','Pendidikan Anak Usia Dini (PAUD)'],
    'Vocational'=>['Teknologi Rekayasa Sistem Elektronika','Manajemen Pemasaran'],
];
function validProdi(string $jalur,string $prodi): bool {
    return isset(PRODI_BY_JALUR[$jalur]) && in_array($prodi,PRODI_BY_JALUR[$jalur],true);
}
function allProdi(): array { return array_merge(...array_values(PRODI_BY_JALUR)); }
const PRODI_KODE=['Matematika'=>'MAT','Pendidikan Anak Usia Dini (PAUD)'=>'PAUD','Teknologi Rekayasa Sistem Elektronika'=>'TRSE','Manajemen Pemasaran'=>'MP'];
const KAMPUS='Universitas Negeri Malang';   // C-DFS difokuskan untuk mahasiswa aktif UM
const SUMBER_VERIF=['Deteksi otomatis','Dibaca AI','Data contoh'];

/* ---------- Helper Jobprovider ---------- */
function requireProvider(): int {
    if(empty($_SESSION['user_id'])) jsonResponse(['success'=>false,'message'=>'Belum login.'],401);
    $q=db()->prepare('SELECT role FROM users WHERE id=? LIMIT 1'); $q->execute([(int)$_SESSION['user_id']]);
    if(($q->fetchColumn()?:'')!=='Jobprovider') jsonResponse(['success'=>false,'message'=>'Fitur khusus Jobprovider.'],403);
    return (int)$_SESSION['user_id'];
}

/* Sumber kebutuhan industri:
   1) lowongan aktif (Kelola Lowongan)
   2) kompetensi & bahasa per perusahaan per prodi yang belum punya lowongan aktif untuk prodi itu */
function buildDemand(): array {
    $rows=db()->query("SELECT l.*,u.instansi FROM lowongan_kerja l JOIN users u ON u.id=l.provider_id AND u.role='Jobprovider' WHERE l.status='Aktif' ORDER BY l.created_at DESC")->fetchAll();
    $low=[]; $adaLowongan=[];
    foreach($rows as $r){
        $l=lowonganRow($r);
        $low[]=['id'=>'L'.$l['id'],'tipe'=>'lowongan','posisi'=>$l['posisi'],'perusahaan'=>$r['instansi'],'prodi'=>$l['prodi'],
            'lokasi'=>$l['lokasi'],'kompetensi'=>$l['kompetensi'],'bahasa'=>$l['bahasa'],'created_at'=>$l['created_at']];
        $adaLowongan[$r['provider_id'].'|'.$l['prodi']]=true;
    }
    $rows=db()->query("SELECT k.provider_id,u.instansi,k.prodi,k.nama,k.jenis,k.level,k.created_at FROM kompetensi k JOIN users u ON u.id=k.provider_id AND u.role='Jobprovider' ORDER BY u.instansi,k.prodi,k.id")->fetchAll();
    $keb=[];
    foreach($rows as $r){
        $key=$r['provider_id'].'|'.$r['prodi'];
        if(isset($adaLowongan[$key])) continue;
        if(!isset($keb[$key])) $keb[$key]=['id'=>'K'.$key,'tipe'=>'kebutuhan','posisi'=>null,'perusahaan'=>$r['instansi'],'prodi'=>$r['prodi'],'lokasi'=>'','kompetensi'=>[],'bahasa'=>[],'created_at'=>$r['created_at']];
        if($r['jenis']==='bahasa') $keb[$key]['bahasa'][]=['nama'=>$r['nama'],'level'=>$r['level']];
        else $keb[$key]['kompetensi'][]=$r['nama'];
        if($r['created_at']>$keb[$key]['created_at']) $keb[$key]['created_at']=$r['created_at'];
    }
    return array_merge($low,array_values($keb));
}
const STATUS_LAMARAN=['Dikirim','Ditinjau','Diundang','Diterima','Ditolak'];


/* ---------- Analisis kompetensi prodi (agregat, anonim) ----------
   Logika sama dengan js/app.js (tokens/relScore/bobot). Data mahasiswa lain TIDAK dikirim ke browser;
   yang dikirim hanya angka agregat, dan baru ditampilkan bila ada >= MIN_MHS mahasiswa. */
const MIN_MHS=3;
const READY=0.75;   // bukti kuat: MK terkait bernilai >= B, atau sertifikat terkait
const STOPW=['dan','atau','the','of','and','untuk','dengan','dalam','pada','dasar','lanjut','lanjutan','pengantar','praktik','praktikum','teori','sistem','teknik','manajemen','pengembangan','aplikasi','tenaga','mata','kuliah'];
const WEAKW=['digital','data','dasar','terapan','umum','modern','bisnis','industri','komputer','profesional','fundamentals','fundamental','kreatif','anak','matematika'];
const GRADE_VAL=['A'=>4,'A-'=>3.7,'AB'=>3.5,'B+'=>3.3,'B'=>3,'B-'=>2.7,'BC'=>2.5,'C+'=>2.3,'C'=>2,'D'=>1,'E'=>0];
const LEVEL_VAL=['Basic'=>0.4,'Intermediate'=>0.7,'Advanced'=>1];
function tokens($t): array {
    $t=preg_replace('/[^a-z0-9]+/',' ',strtolower((string)$t));
    return array_values(array_filter(explode(' ',$t),fn($w)=>strlen($w)>=3&&!in_array($w,STOPW,true)));
}
function sameTok(string $x,string $y): bool { return $x===$y||(strlen($x)>=5&&strlen($y)>=5&&(str_contains($x,$y)||str_contains($y,$x))); }
function relScore($a,$b): float {
    $ta=tokens($a); $tb=tokens($b); if(!$ta||!$tb) return 0.0;
    $hits=array_values(array_filter($ta,function($x)use($tb){ foreach($tb as $y) if(sameTok($x,$y)) return true; return false; }));
    $ok=count($hits)===count($ta); foreach($hits as $h) if(!in_array($h,WEAKW,true)) $ok=true;
    return $ok?count($hits)/count($ta)+count($hits)/count($tb):0.0;
}
function bobotMk(array $m): float {
    if(isset($m['na'])&&is_numeric($m['na'])&&$m['na']>=0&&$m['na']<=4) return (float)$m['na'];
    return (float)(GRADE_VAL[$m['nilai']??'']??0);
}
function normLang($n): string { return trim(preg_replace('/^bahasa\s+/','',mb_strtolower((string)$n))); }
function analisisProdi(string $prodi,array $sources,array $studs): array {
    $S=array_values(array_filter($sources,fn($x)=>$x['prodi']===$prodi));
    $n=count($S); $ns=count($studs); $cukup=$ns>=MIN_MHS;
    $km=[];
    foreach($S as $src){ $seen=[]; foreach($src['kompetensi'] as $k){ $k=trim((string)$k); $key=mb_strtolower($k);
        if($k===''||isset($seen[$key])) continue; $seen[$key]=1; if(!isset($km[$key])) $km[$key]=['nama'=>$k,'n'=>0]; $km[$key]['n']++; } }
    $komp=[];
    foreach($km as $k){
        $ready=null; $mk=[]; $certN=0;
        if($cukup){
            $rel=[]; foreach($studs as $st) foreach($st['mk'] as $m) if(empty($m['umum'])&&!isset($rel[$m['nama']])) $rel[$m['nama']]=relScore($k['nama'],$m['nama']);
            $maxRel=$rel?max($rel):0; $ok=0; $agg=[];
            foreach($studs as $st){
                $best=0;
                foreach($st['mk'] as $m){
                    if(!empty($m['umum'])||$maxRel<=0||($rel[$m['nama']]??0)<0.8*$maxRel) continue;
                    $best=max($best,bobotMk($m)/4);
                    $agg[$m['nama']]['sum']=($agg[$m['nama']]['sum']??0)+bobotMk($m); $agg[$m['nama']]['n']=($agg[$m['nama']]['n']??0)+1;
                }
                $cert=false; foreach($st['cert'] as $c) if(relScore($k['nama'],$c['nama']??'')>0) $cert=true;
                if($cert) $certN++;
                if($best>=READY||$cert) $ok++;
            }
            $ready=100*$ok/$ns;
            foreach($agg as $nm=>$a) $mk[]=['nama'=>$nm,'avg'=>round($a['sum']/$a['n'],2),'n'=>$a['n'],'r'=>$rel[$nm]];
            usort($mk,fn($x,$y)=>($y['r']<=>$x['r'])?:($y['n']<=>$x['n']));
        }
        $komp[]=['nama'=>$k['nama'],'n'=>$k['n'],'demand'=>$n?100*$k['n']/$n:0,'ready'=>$ready,'mk'=>$mk,'certN'=>$certN];
    }
    $lm=[];
    foreach($S as $src) foreach($src['bahasa'] as $b){ $key=normLang($b['nama']??'');
        if($key==='') continue; if(!isset($lm[$key])) $lm[$key]=['nama'=>$b['nama'],'level'=>$b['level'],'n'=>0]; $lm[$key]['n']++;
        if((LEVEL_VAL[$b['level']]??0)>(LEVEL_VAL[$lm[$key]['level']]??0)) $lm[$key]['level']=$b['level']; }
    $langs=[];
    foreach($lm as $key=>$b){
        $ready=null;
        if($cukup){ $ok=0; foreach($studs as $st) foreach($st['bahasa'] as $h) if(normLang($h['nama']??'')===$key&&(LEVEL_VAL[$h['level']??'']??0)>=(LEVEL_VAL[$b['level']]??1)){ $ok++; break; } $ready=100*$ok/$ns; }
        $langs[]=$b+['demand'=>100*$b['n']/$n,'ready'=>$ready];
    }
    return ['komp'=>$komp,'langs'=>$langs,'mahasiswa'=>$ns,'cukup'=>$cukup];
}

/* ---------- Helper Jobseeker ---------- */
const LEVELS=['Basic','Intermediate','Advanced'];
function cleanLang($nama): string {
    $n=trim(preg_replace('/^bahasa\s+/i','',mb_substr((string)$nama,0,40)));
    return $n===''?'':mb_strtoupper(mb_substr($n,0,1)).mb_substr($n,1);
}
function cleanLangList($list): array {
    $out=[]; foreach(array_slice((array)$list,0,10) as $b){
        $n=cleanLang($b['nama']??''); $l=(string)($b['level']??'');
        if($n!==''&&in_array($l,LEVELS,true)){ foreach($out as $o) if(mb_strtolower($o['nama'])===mb_strtolower($n)) continue 2; $out[]=['nama'=>$n,'level'=>$l]; }
    }
    return $out;
}
function lowonganRow(array $r): array {
    return ['id'=>(int)$r['id'],'posisi'=>$r['posisi'],'prodi'=>$r['prodi'],'lokasi'=>$r['lokasi']??'','deskripsi'=>$r['deskripsi']??'',
        'kompetensi'=>json_decode($r['kompetensi']?:'[]',true)?:[],'bahasa'=>json_decode($r['bahasa']?:'[]',true)?:[],
        'status'=>$r['status'],'created_at'=>$r['created_at']];
}
const GRADE_KEYS=['A','A-','AB','B+','B','B-','BC','C+','C','D','E'];
function requireJobseeker(): int {
    if(empty($_SESSION['user_id'])) jsonResponse(['success'=>false,'message'=>'Belum login.'],401);
    $q=db()->prepare('SELECT role FROM users WHERE id=? LIMIT 1'); $q->execute([(int)$_SESSION['user_id']]);
    if(($q->fetchColumn()?:'')!=='Jobseeker') jsonResponse(['success'=>false,'message'=>'Fitur khusus Jobseeker.'],403);
    return (int)$_SESSION['user_id'];
}
function str150($v): string { return trim(mb_substr((string)$v,0,150)); }
/* Panggil Claude (Messages API). $content = array blok konten. Mengembalikan teks atau null. */
function callClaude(array $content,int $maxTokens=800): ?string {
    if(AI_API_KEY===''||!function_exists('curl_init')) return null;
    $ch=curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>90,
        CURLOPT_HTTPHEADER=>['content-type: application/json','x-api-key: '.AI_API_KEY,'anthropic-version: 2023-06-01'],
        CURLOPT_POSTFIELDS=>json_encode(['model'=>AI_MODEL,'max_tokens'=>$maxTokens,'messages'=>[['role'=>'user','content'=>$content]]],JSON_UNESCAPED_UNICODE)]);
    $raw=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
    $res=json_decode((string)$raw,true); $text='';
    foreach(($res['content']??[]) as $blk) if(($blk['type']??'')==='text') $text.=$blk['text'];
    if($code!==200||$text===''){ error_log('AI error '.$code.' '.$err.' '.substr((string)$raw,0,300)); return null; }
    return $text;
}
function jsonFromText(string $t): ?array {
    $a=strpos($t,'{'); $b=strrpos($t,'}');
    if($a===false||$b===false||$b<$a) return null;
    $d=json_decode(substr($t,$a,$b-$a+1),true);
    return is_array($d)?$d:null;
}

try {
    if($action==='register'){
        $name=trim((string)($input['name']??'')); $email=trim((string)($input['email']??''));
        $instansi=trim((string)($input['instansi']??'')); $role=trim((string)($input['role']??'Jobseeker'));
        $jalur=trim((string)($input['jalur']??'')); $prodi=trim((string)($input['prodi']??''));
        if($name===''||$instansi===''||!filter_var($email,FILTER_VALIDATE_EMAIL))
            jsonResponse(['success'=>false,'message'=>'Data registrasi belum lengkap.'],422);
        if(!in_array($role,ROLES,true))
            jsonResponse(['success'=>false,'message'=>'Peran tidak valid.'],422);
        // Jalur & prodi Jobseeker dipilih setelah login (Dashboard); saat registrasi boleh kosong
        if($role==='Jobseeker') $instansi=KAMPUS;
        if($role==='Jobseeker' && ($jalur!==''||$prodi!=='')){
            if(!validProdi($jalur,$prodi))
                jsonResponse(['success'=>false,'message'=>'Jalur pendidikan/program studi tidak valid.'],422);
        } else { $jalur=null; $prodi=null; }
        $q=db()->prepare('SELECT id FROM users WHERE email=? LIMIT 1'); $q->execute([$email]);
        if($q->fetch()) jsonResponse(['success'=>false,'message'=>'Email sudah terdaftar.'],409);
        $hash=password_hash('CDFS@12345',PASSWORD_DEFAULT);
        $q=db()->prepare('INSERT INTO users(name,email,password_hash,instansi,role,jalur,prodi) VALUES(?,?,?,?,?,?,?)');
        $q->execute([$name,$email,$hash,$instansi,$role,$jalur,$prodi]);
        $_SESSION['user_id']=(int)db()->lastInsertId(); $_SESSION['user_name']=$name;
        jsonResponse(['success'=>true,'message'=>'Registrasi berhasil. Password awal: CDFS@12345',
            'user'=>['name'=>$name,'email'=>$email,'instansi'=>$instansi,'role'=>$role,'jalur'=>$jalur,'prodi'=>$prodi]]);
    }
    if($action==='login'){
        $email=trim((string)($input['email']??'')); $password=(string)($input['password']??'');
        $q=db()->prepare('SELECT id,name,email,password_hash,instansi,role,jalur,prodi FROM users WHERE email=? LIMIT 1');
        $q->execute([$email]); $u=$q->fetch();
        if(!$u||!password_verify($password,$u['password_hash']))
            jsonResponse(['success'=>false,'message'=>'Email atau kata sandi salah.'],401);
        $_SESSION['user_id']=(int)$u['id']; $_SESSION['user_name']=$u['name']; unset($u['password_hash']);
        jsonResponse(['success'=>true,'user'=>$u]);
    }
    if($action==='update_prodi'){
        if(empty($_SESSION['user_id'])) jsonResponse(['success'=>false,'message'=>'Belum login.'],401);
        $jalur=trim((string)($input['jalur']??'')); $prodi=trim((string)($input['prodi']??''));
        if(!validProdi($jalur,$prodi))
            jsonResponse(['success'=>false,'message'=>'Jalur/program studi tidak valid.'],422);
        $q=db()->prepare("UPDATE users SET jalur=?,prodi=? WHERE id=? AND role='Jobseeker'");
        $q->execute([$jalur,$prodi,(int)$_SESSION['user_id']]);
        jsonResponse(['success'=>true,'jalur'=>$jalur,'prodi'=>$prodi]);
    }
    /* ================= JOBPROVIDER ================= */
    if($action==='jp_bootstrap'){
        $pid=requireProvider();
        $q=db()->prepare('SELECT id,nama,prodi,jenis,level FROM kompetensi WHERE provider_id=? ORDER BY id'); $q->execute([$pid]);
        $komp=array_map(fn($r)=>['id'=>(int)$r['id'],'nama'=>$r['nama'],'prodi'=>$r['prodi'],'jenis'=>$r['jenis'],'level'=>$r['level']],$q->fetchAll());
        $q=db()->prepare('SELECT * FROM lowongan_kerja WHERE provider_id=? ORDER BY created_at DESC,id DESC'); $q->execute([$pid]);
        $low=array_map('lowonganRow',$q->fetchAll());
        $q=db()->prepare('SELECT jobseeker_id FROM shortlist_kandidat WHERE provider_id=?'); $q->execute([$pid]);
        $short=array_map(fn($v)=>(string)$v,$q->fetchAll(PDO::FETCH_COLUMN));
        // Kandidat: Jobseeker yang sudah memilih prodi, beserta ringkasan transkrip/sertifikat/bahasa (tanpa email)
        // Hanya Jobseeker yang mengizinkan profilnya dilihat, atau yang melamar ke lowongan perusahaan ini
        $q=db()->prepare("SELECT u.id,u.name,u.instansi,u.jalur,u.prodi,p.transkrip,p.sertifikat,p.bahasa FROM users u
            JOIN jobseeker_profil p ON p.user_id=u.id
            WHERE u.role='Jobseeker' AND u.prodi IS NOT NULL
              AND (p.tampil=1 OR u.id IN (SELECT la.jobseeker_id FROM lamaran la JOIN lowongan_kerja l ON l.id=la.lowongan_id WHERE l.provider_id=?))
            ORDER BY u.name");
        $q->execute([$pid]); $cands=$q->fetchAll();
        foreach($cands as &$c){
            $tr=json_decode($c['transkrip']??'[]',true)?:[]; $rows=isset($tr['rows'])?$tr['rows']:$tr;
            $c['mk']=array_map(fn($m)=>array_intersect_key($m,array_flip(['nama','nilai','na','manual'])),array_slice($rows,0,100));
            $c['verif']=in_array($tr['meta']['sumber']??'',SUMBER_VERIF,true);
            $c['cert']=array_map(fn($x)=>['nama'=>$x['nama']??'','jenis'=>$x['jenis']??''],json_decode($c['sertifikat']??'[]',true)?:[]);
            $c['bahasa']=json_decode($c['bahasa']??'[]',true)?:[];
            $c['id']=(int)$c['id']; unset($c['transkrip'],$c['sertifikat']);
        } unset($c);
        $q=db()->prepare('SELECT la.lowongan_id,la.jobseeker_id,la.status,la.created_at FROM lamaran la JOIN lowongan_kerja l ON l.id=la.lowongan_id WHERE l.provider_id=? ORDER BY la.created_at DESC');
        $q->execute([$pid]);
        $lam=array_map(fn($r)=>['lowongan_id'=>(int)$r['lowongan_id'],'jobseeker_id'=>(int)$r['jobseeker_id'],'status'=>$r['status'],'created_at'=>$r['created_at']],$q->fetchAll());
        jsonResponse(['success'=>true,'kompetensi'=>$komp,'lowongan'=>$low,'shortlist'=>$short,'candidates'=>$cands,'lamaran'=>$lam,'ai_enabled'=>AI_API_KEY!==''&&function_exists('curl_init')]);
    }
    if($action==='jp_kompetensi_add'){
        $pid=requireProvider();
        $jenis=($input['jenis']??'')==='bahasa'?'bahasa':'kompetensi'; $prodi=(string)($input['prodi']??'');
        $nama=$jenis==='bahasa'?cleanLang($input['nama']??''):trim(mb_substr((string)($input['nama']??''),0,100));
        $level=$jenis==='bahasa'?(string)($input['level']??''):null;
        if($nama===''||!in_array($prodi,allProdi(),true)||($jenis==='bahasa'&&!in_array($level,LEVELS,true)))
            jsonResponse(['success'=>false,'message'=>'Nama, program studi, dan tingkat (untuk bahasa) wajib diisi.'],422);
        $q=db()->prepare('SELECT id FROM kompetensi WHERE provider_id=? AND prodi=? AND jenis=? AND LOWER(nama)=LOWER(?)'); $q->execute([$pid,$prodi,$jenis,$nama]);
        $ada=$q->fetchColumn();
        if($ada&&$jenis==='kompetensi') jsonResponse(['success'=>false,'message'=>'Kompetensi sudah ada.'],409);
        if($ada){ db()->prepare('UPDATE kompetensi SET level=? WHERE id=?')->execute([$level,(int)$ada]); $id=(int)$ada; }
        else { db()->prepare('INSERT INTO kompetensi(provider_id,nama,prodi,jenis,level) VALUES(?,?,?,?,?)')->execute([$pid,$nama,$prodi,$jenis,$level]); $id=(int)db()->lastInsertId(); }
        jsonResponse(['success'=>true,'kompetensi'=>['id'=>$id,'nama'=>$nama,'prodi'=>$prodi,'jenis'=>$jenis,'level'=>$level]]);
    }
    /* ---------- Deteksi poster lowongan dengan AI (gambar / PDF) ---------- */
    if($action==='jp_ai_lowongan'){
        requireProvider();
        if(AI_API_KEY==='') jsonResponse(['success'=>false,'ai'=>false,'message'=>'API key AI belum diisi.']);
        $mt=(string)($input['media_type']??''); $data=(string)($input['data']??'');
        if(!in_array($mt,['image/jpeg','image/png','image/webp','image/gif','application/pdf'],true)||$data===''||strlen($data)>7000000)
            jsonResponse(['success'=>false,'message'=>'File tidak didukung atau terlalu besar (maks. 5 MB).'],422);
        $blok=$mt==='application/pdf'?['type'=>'document','source'=>['type'=>'base64','media_type'=>$mt,'data'=>$data]]:['type'=>'image','source'=>['type'=>'base64','media_type'=>$mt,'data'=>$data]];
        $prompt="Ini adalah poster/pengumuman lowongan kerja. Ekstrak isinya dan jawab HANYA dengan JSON valid tanpa teks lain:\n"
            ."{\"posisi\":\"\",\"perusahaan\":\"\",\"lokasi\":\"\",\"deskripsi\":\"ringkasan tugas maks 400 karakter\",\"kompetensi\":[\"kompetensi/keahlian teknis singkat, maks 10\"],"
            ."\"bahasa\":[{\"nama\":\"Inggris\",\"level\":\"Basic|Intermediate|Advanced\"}],\"prodi\":\"salah satu dari: ".implode(' | ',allProdi())." atau kosong\"}\n"
            ."Kompetensi berisi keahlian (mis. PLC, Digital Marketing), BUKAN syarat umum seperti usia, jenis kelamin, IPK, SIM, atau sifat pribadi. "
            ."Bahasa hanya bila disebut di poster. Jangan mengarang isi yang tidak ada.";
        $text=callClaude([$blok,['type'=>'text','text'=>$prompt]],900);
        $d=$text!==null?jsonFromText($text):null;
        if(!$d) jsonResponse(['success'=>false,'ai'=>true,'message'=>'Poster tidak dapat dibaca oleh AI.']);
        $komp=[]; foreach(array_slice((array)($d['kompetensi']??[]),0,12) as $k){ $k=trim(mb_substr((string)$k,0,100)); if($k!=='') $komp[]=$k; }
        $prodi=in_array($d['prodi']??'',allProdi(),true)?$d['prodi']:'';
        jsonResponse(['success'=>true,'ai'=>true,'data'=>['posisi'=>trim(mb_substr((string)($d['posisi']??''),0,120)),'perusahaan'=>str150($d['perusahaan']??''),
            'lokasi'=>trim(mb_substr((string)($d['lokasi']??''),0,100)),'deskripsi'=>trim(mb_substr((string)($d['deskripsi']??''),0,1000)),
            'kompetensi'=>array_values(array_unique($komp)),'bahasa'=>cleanLangList($d['bahasa']??[]),'prodi'=>$prodi]]);
    }
    /* ---------- Kelola Lowongan ---------- */
    if($action==='jp_lowongan_save'){
        $pid=requireProvider();
        $posisi=trim(mb_substr((string)($input['posisi']??''),0,120)); $prodi=(string)($input['prodi']??'');
        $komp=[]; foreach(array_slice((array)($input['kompetensi']??[]),0,20) as $k){ $k=trim(mb_substr((string)$k,0,100)); if($k!==''&&!in_array($k,$komp,true)) $komp[]=$k; }
        $bahasa=cleanLangList($input['bahasa']??[]);
        if($posisi===''||!in_array($prodi,allProdi(),true)||!$komp)
            jsonResponse(['success'=>false,'message'=>'Posisi, program studi, dan minimal satu kompetensi wajib diisi.'],422);
        $vals=[$posisi,$prodi,trim(mb_substr((string)($input['lokasi']??''),0,100)),trim(mb_substr((string)($input['deskripsi']??''),0,1000)),
            json_encode($komp,JSON_UNESCAPED_UNICODE),json_encode($bahasa,JSON_UNESCAPED_UNICODE)];
        $id=(int)($input['id']??0);
        if($id){
            $q=db()->prepare('UPDATE lowongan_kerja SET posisi=?,prodi=?,lokasi=?,deskripsi=?,kompetensi=?,bahasa=? WHERE id=? AND provider_id=?');
            $q->execute([...$vals,$id,$pid]);
        } else {
            db()->prepare('INSERT INTO lowongan_kerja(posisi,prodi,lokasi,deskripsi,kompetensi,bahasa,provider_id) VALUES(?,?,?,?,?,?,?)')->execute([...$vals,$pid]);
            $id=(int)db()->lastInsertId();
        }
        $q=db()->prepare('SELECT * FROM lowongan_kerja WHERE id=? AND provider_id=?'); $q->execute([$id,$pid]); $r=$q->fetch();
        if(!$r) jsonResponse(['success'=>false,'message'=>'Lowongan tidak ditemukan.'],404);
        // Kompetensi & bahasa baru otomatis disimpan ke Kebutuhan Kompetensi Umum (bahasa yang sudah ada tidak diubah)
        $cek=db()->prepare('SELECT id FROM kompetensi WHERE provider_id=? AND prodi=? AND jenis=? AND LOWER(nama)=LOWER(?)');
        $ins=db()->prepare('INSERT INTO kompetensi(provider_id,nama,prodi,jenis,level) VALUES(?,?,?,?,?)');
        foreach($komp as $k){ $cek->execute([$pid,$prodi,'kompetensi',$k]); if(!$cek->fetchColumn()) $ins->execute([$pid,$k,$prodi,'kompetensi',null]); }
        foreach($bahasa as $b){ $cek->execute([$pid,$prodi,'bahasa',$b['nama']]); if(!$cek->fetchColumn()) $ins->execute([$pid,$b['nama'],$prodi,'bahasa',$b['level']]); }
        $q=db()->prepare('SELECT id,nama,prodi,jenis,level FROM kompetensi WHERE provider_id=? ORDER BY id'); $q->execute([$pid]);
        $kompAll=array_map(fn($x)=>['id'=>(int)$x['id'],'nama'=>$x['nama'],'prodi'=>$x['prodi'],'jenis'=>$x['jenis'],'level'=>$x['level']],$q->fetchAll());
        jsonResponse(['success'=>true,'lowongan'=>lowonganRow($r),'kompetensi'=>$kompAll]);
    }
    if($action==='jp_lowongan_status'){
        $pid=requireProvider(); $status=($input['status']??'')==='Ditutup'?'Ditutup':'Aktif';
        $q=db()->prepare('UPDATE lowongan_kerja SET status=? WHERE id=? AND provider_id=?'); $q->execute([$status,(int)($input['id']??0),$pid]);
        jsonResponse(['success'=>true,'status'=>$status]);
    }
    if($action==='jp_lowongan_delete'){
        $pid=requireProvider();
        $q=db()->prepare('DELETE FROM lowongan_kerja WHERE id=? AND provider_id=?'); $q->execute([(int)($input['id']??0),$pid]);
        if(!$q->rowCount()) jsonResponse(['success'=>false,'message'=>'Lowongan tidak ditemukan.'],404);
        jsonResponse(['success'=>true]);
    }
    if($action==='jp_kompetensi_delete'){
        $pid=requireProvider();
        $q=db()->prepare('DELETE FROM kompetensi WHERE id=? AND provider_id=?'); $q->execute([(int)($input['id']??0),$pid]);
        if(!$q->rowCount()) jsonResponse(['success'=>false,'message'=>'Kompetensi tidak ditemukan.'],404);
        jsonResponse(['success'=>true]);
    }
    if($action==='jp_lamaran_status'){
        $pid=requireProvider(); $status=(string)($input['status']??'');
        if(!in_array($status,STATUS_LAMARAN,true)) jsonResponse(['success'=>false,'message'=>'Status tidak valid.'],422);
        $q=db()->prepare('UPDATE lamaran la JOIN lowongan_kerja l ON l.id=la.lowongan_id SET la.status=? WHERE la.lowongan_id=? AND la.jobseeker_id=? AND l.provider_id=?');
        $q->execute([$status,(int)($input['lowongan_id']??0),(int)($input['jobseeker_id']??0),$pid]);
        jsonResponse(['success'=>true,'status'=>$status]);
    }
    if($action==='jp_shortlist'){
        $pid=requireProvider(); $js=(int)($input['jobseeker_id']??0);
        $q=db()->prepare("SELECT id FROM users WHERE id=? AND role='Jobseeker'"); $q->execute([$js]);
        if(!$q->fetch()) jsonResponse(['success'=>false,'message'=>'Kandidat tidak ditemukan.'],404);
        if(!empty($input['on'])) db()->prepare('INSERT IGNORE INTO shortlist_kandidat(provider_id,jobseeker_id) VALUES(?,?)')->execute([$pid,$js]);
        else db()->prepare('DELETE FROM shortlist_kandidat WHERE provider_id=? AND jobseeker_id=?')->execute([$pid,$js]);
        jsonResponse(['success'=>true]);
    }
    /* ================= JOBSEEKER: JOB MATCHING ================= */
    if($action==='js_profile'){
        $uid=requireJobseeker();
        $q=db()->prepare('SELECT transkrip,sertifikat,bahasa,tampil FROM jobseeker_profil WHERE user_id=?'); $q->execute([$uid]); $p=$q->fetch()?:[];
        $low=buildDemand();
        $q=db()->prepare('SELECT la.lowongan_id,la.status,la.updated_at,l.posisi,l.status AS status_lowongan,u.instansi FROM lamaran la JOIN lowongan_kerja l ON l.id=la.lowongan_id JOIN users u ON u.id=l.provider_id WHERE la.jobseeker_id=? ORDER BY la.updated_at DESC'); $q->execute([$uid]);
        $lam=array_map(fn($r)=>['lowongan_id'=>'L'.$r['lowongan_id'],'status'=>$r['status'],'updated_at'=>$r['updated_at'],'posisi'=>$r['posisi'],'perusahaan'=>$r['instansi'],'lowongan_ditutup'=>$r['status_lowongan']!=='Aktif'],$q->fetchAll());
        $tr=json_decode($p['transkrip']??'[]',true)?:[];
        $rowsTr=isset($tr['rows'])?$tr['rows']:$tr; $meta=$tr['meta']??new stdClass();
        jsonResponse(['success'=>true,'transkrip'=>$rowsTr,'transkrip_meta'=>$meta,
            'sertifikat'=>json_decode($p['sertifikat']??'[]',true)?:[],'bahasa'=>json_decode($p['bahasa']??'[]',true)?:[],'lowongan'=>$low,'lamaran'=>$lam,'tampil'=>!empty($p['tampil']),
            'ai_enabled'=>AI_API_KEY!==''&&function_exists('curl_init')]);
    }
    if($action==='js_profile_save'){
        $uid=requireJobseeker();
        $mk=[]; foreach(array_slice((array)($input['transkrip']??[]),0,100) as $m){
            $nama=str150($m['nama']??''); $sks=(int)($m['sks']??0); $nilai=strtoupper(trim((string)($m['nilai']??'')));
            if($nama!==''&&$sks>=1&&$sks<=8&&in_array($nilai,GRADE_KEYS,true)) $mk[]=['nama'=>$nama,'sks'=>$sks,'nilai'=>$nilai]+(isset($m['na'])&&is_numeric($m['na'])&&$m['na']>=0&&$m['na']<=4?['na'=>(float)$m['na']]:[])+(!empty($m['umum'])?['umum'=>true]:[])+(!empty($m['manual'])?['manual'=>true]:[]);
        }
        $cert=[]; foreach(array_slice((array)($input['sertifikat']??[]),0,30) as $c){
            $nama=str150($c['nama']??''); $jenis=($c['jenis']??'')==='BNSP'?'BNSP':'Non-BNSP';
            if($nama!=='') $cert[]=['nama'=>$nama,'jenis'=>$jenis,'lembaga'=>str150($c['lembaga']??''),
                'file'=>str150($c['file']??''),'sumber'=>str150($c['sumber']??'')];
        }
        // Kemahiran bahasa: nama bebas (maks. 40 karakter) + tingkat Basic/Intermediate/Advanced
        $bahasa=[]; foreach(array_slice((array)($input['bahasa']??[]),0,10) as $b){
            $nama=trim(mb_substr((string)($b['nama']??''),0,40)); $level=(string)($b['level']??'');
            if($nama!==''&&in_array($level,['Basic','Intermediate','Advanced'],true)) $bahasa[]=['nama'=>$nama,'level'=>$level];
        }
        $m=(array)($input['transkrip_meta']??[]);
        $meta=['file'=>str150($m['file']??''),'sumber'=>str150($m['sumber']??''),'prodi_dokumen'=>str150($m['prodi_dokumen']??''),
            'ipk_dokumen'=>isset($m['ipk_dokumen'])&&is_numeric($m['ipk_dokumen'])?(float)$m['ipk_dokumen']:null];
        $tampil=!empty($input['tampil'])?1:0;
        db()->prepare('INSERT INTO jobseeker_profil(user_id,transkrip,sertifikat,bahasa,tampil) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE transkrip=VALUES(transkrip),sertifikat=VALUES(sertifikat),bahasa=VALUES(bahasa),tampil=VALUES(tampil)')
            ->execute([$uid,json_encode(['rows'=>$mk,'meta'=>$meta],JSON_UNESCAPED_UNICODE),json_encode($cert,JSON_UNESCAPED_UNICODE),json_encode($bahasa,JSON_UNESCAPED_UNICODE),$tampil]);
        jsonResponse(['success'=>true,'jumlah_mk'=>count($mk),'jumlah_sertifikat'=>count($cert)]);
    }
    if($action==='js_lamar'){
        $uid=requireJobseeker();
        $lid=(int)preg_replace('/\D/','',(string)($input['lowongan_id']??''));
        $q=db()->prepare("SELECT id FROM lowongan_kerja WHERE id=? AND status='Aktif'"); $q->execute([$lid]);
        if(!$q->fetch()) jsonResponse(['success'=>false,'message'=>'Lowongan tidak ditemukan atau sudah ditutup.'],404);
        $q=db()->prepare('SELECT transkrip FROM jobseeker_profil WHERE user_id=?'); $q->execute([$uid]);
        $tr=json_decode((string)($q->fetchColumn()?:'[]'),true)?:[];
        if(!(isset($tr['rows'])?$tr['rows']:$tr)) jsonResponse(['success'=>false,'message'=>'Upload transkrip nilai terlebih dahulu sebelum melamar.'],422);
        db()->prepare('INSERT IGNORE INTO lamaran(lowongan_id,jobseeker_id) VALUES(?,?)')->execute([$lid,$uid]);
        $q=db()->prepare('SELECT la.status,la.updated_at,l.posisi,u.instansi FROM lamaran la JOIN lowongan_kerja l ON l.id=la.lowongan_id JOIN users u ON u.id=l.provider_id WHERE la.lowongan_id=? AND la.jobseeker_id=?'); $q->execute([$lid,$uid]); $r=$q->fetch();
        jsonResponse(['success'=>true,'lamaran'=>['lowongan_id'=>'L'.$lid,'status'=>$r['status'],'updated_at'=>$r['updated_at'],'posisi'=>$r['posisi'],'perusahaan'=>$r['instansi'],'lowongan_ditutup'=>false]]);
    }
    if($action==='js_ai_extract'){
        requireJobseeker();
        if(AI_API_KEY==='') jsonResponse(['success'=>false,'message'=>'API key AI belum diisi.'],400);
        $kind=($input['kind']??'')==='sertifikat'?'sertifikat':'transkrip';
        $mt=(string)($input['media_type']??''); $data=(string)($input['data']??'');
        $allowed=['application/pdf','image/jpeg','image/png','image/webp'];
        if(!in_array($mt,$allowed,true)||$data===''||strlen($data)>7_000_000||base64_decode($data,true)===false)
            jsonResponse(['success'=>false,'message'=>'File tidak valid (PDF/JPG/PNG/WEBP, maks. 5 MB).'],422);
        $block=$mt==='application/pdf'
            ?['type'=>'document','source'=>['type'=>'base64','media_type'=>$mt,'data'=>$data]]
            :['type'=>'image','source'=>['type'=>'base64','media_type'=>$mt,'data'=>$data]];
        $prompt=$kind==='transkrip'
            ?"Dokumen ini adalah transkrip / rekap hasil studi mahasiswa. Ekstrak SEMUA mata kuliah. Balas HANYA dengan JSON tanpa penjelasan:\n"
             ."{\"prodi\": \"nama program studi seperti tertulis\", \"ipk\": angka atau null, \"mata_kuliah\": [{\"nama\": \"...\", \"sks\": angka, \"nilai\": \"nilai huruf, mis. A, A-, B+, AB\"}]}\n"
             ."Jangan mengarang; lewati baris yang tidak terbaca."
            :"Dokumen ini adalah sertifikat. Tentukan apakah sertifikat kompetensi BNSP (diterbitkan LSP berlisensi BNSP / mencantumkan BNSP) atau bukan. Balas HANYA dengan JSON:\n"
             ."{\"nama\": \"nama skema / judul kompetensi sertifikat\", \"jenis\": \"BNSP\" atau \"Non-BNSP\", \"lembaga\": \"lembaga penerbit\"}\n"
             ."Jangan mengarang; isi string kosong bila tidak terbaca.";
        $text=callClaude([$block,['type'=>'text','text'=>$prompt]],$kind==='transkrip'?4000:400);
        $d=$text?jsonFromText($text):null;
        if(!$d) jsonResponse(['success'=>false,'message'=>'Dokumen tidak dapat dibaca oleh AI.']);
        jsonResponse(['success'=>true,'data'=>$d]);
    }
    if($action==='js_ai_analisis'){
        requireJobseeker();
        if(AI_API_KEY==='') jsonResponse(['success'=>true,'ai'=>false,'message'=>'API key AI belum diisi.']);
        $data=[
            'prodi'=>str150($input['prodi']??''),'ipk'=>(float)($input['ipk']??0),'total_sks'=>(int)($input['sks']??0),
            'nilai_terbaik'=>array_slice((array)($input['nilai_terbaik']??[]),0,8),
            'sertifikat'=>array_slice((array)($input['sertifikat']??[]),0,30),
            'kemahiran_bahasa'=>array_slice((array)($input['bahasa']??[]),0,10),
            'pekerjaan_cocok_menurut_skor'=>array_slice((array)($input['pekerjaan_cocok']??[]),0,5),
            'skor_per_lowongan_jobprovider'=>array_slice((array)($input['lowongan']??[]),0,5),
        ];
        $prompt="Anda adalah konselor karier untuk mahasiswa/lulusan di Indonesia. Data berikut berasal dari transkrip nilai, sertifikat BNSP/Non-BNSP (opsional), "
            ."dan kemahiran bahasa (opsional) milik Jobseeker, beserta skor yang dihitung sistem C-DFS:\n\n"
            .json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)
            ."\n\nTulis analisis dalam Bahasa Indonesia, maksimal 220 kata, dengan susunan:\n"
            ."1) Satu paragraf: kekuatan utama dari transkrip (sebut mata kuliah bernilai terbaik), sertifikat, dan kemahiran bahasa (jika ada); apakah relevan dengan lowongan yang ada.\n"
            ."2) Satu paragraf: apakah kandidat cocok dengan lowongan yang dibuka industri (sebut posisi & perusahaan, status kecocokan, dan apakah syarat bahasa terpenuhi), serta pekerjaan lain yang cocok; tulis skor apa adanya (jangan mengubah angka).\n"
            ."3) Daftar berpoin (awali dengan \"- \") maksimal 3 langkah konkret untuk meningkatkan skor kesiapan. Skor kesiapan bukan peluang pasti diterima kerja.\n"
            ."Jangan mengarang data yang tidak ada. Gunakan **tebal** untuk nama pekerjaan dan perusahaan.";
        $text=callClaude([['type'=>'text','text'=>$prompt]],900);
        if($text===null) jsonResponse(['success'=>true,'ai'=>false,'message'=>'Layanan AI tidak dapat dihubungi.']);
        jsonResponse(['success'=>true,'ai'=>true,'text'=>$text]);
    }
    /* ================= PRODI / PERGURUAN TINGGI ================= */
    /* ================= JOBSEEKER: KOMPETENSI PRODI ================= */
    if($action==='js_prodi'){
        $uid=requireJobseeker();
        $q=db()->prepare('SELECT prodi FROM users WHERE id=?'); $q->execute([$uid]); $prodi=(string)($q->fetchColumn()?:'');
        if($prodi==='') jsonResponse(['success'=>true,'prodi'=>'','sources'=>[],'analisis'=>null]);
        $sources=array_values(array_filter(buildDemand(),fn($x)=>$x['prodi']===$prodi));
        // Hanya mahasiswa UM dengan transkrip yang terbaca otomatis dari dokumen, dan prodi di dokumen sesuai prodi akun
        $q=db()->prepare("SELECT p.transkrip,p.sertifikat,p.bahasa FROM users u JOIN jobseeker_profil p ON p.user_id=u.id WHERE u.role='Jobseeker' AND u.prodi=? AND u.instansi=?");
        $q->execute([$prodi,KAMPUS]); $studs=[]; $ditolak=0;
        $inti=mb_strtolower(trim(preg_replace('/\s*\(.*\)\s*/',' ',$prodi))); $kode=PRODI_KODE[$prodi]??'';
        foreach($q->fetchAll() as $r){
            $tr=json_decode($r['transkrip']??'[]',true)?:[]; $mk=isset($tr['rows'])?$tr['rows']:$tr; $meta=$tr['meta']??[];
            if(!$mk) continue;
            $doc=mb_strtolower((string)($meta['prodi_dokumen']??''));
            $prodiCocok=$doc===''||str_contains($doc,$inti)||($kode!==''&&preg_match('/\b'.strtolower($kode).'\b/',$doc));
            $mk=array_values(array_filter($mk,fn($m)=>empty($m['manual'])));
            if(!in_array($meta['sumber']??'',SUMBER_VERIF,true)||!$prodiCocok||!$mk){ $ditolak++; continue; }
            $cert=array_values(array_filter(json_decode($r['sertifikat']??'[]',true)?:[],fn($c)=>in_array($c['sumber']??'',SUMBER_VERIF,true)));
            $studs[]=['mk'=>$mk,'cert'=>$cert,'bahasa'=>json_decode($r['bahasa']??'[]',true)?:[]];
        }
        $q=db()->prepare("SELECT COUNT(*) FROM users WHERE role='Jobseeker' AND prodi=? AND instansi=?"); $q->execute([$prodi,KAMPUS]);
        jsonResponse(['success'=>true,'prodi'=>$prodi,'sources'=>$sources,'analisis'=>analisisProdi($prodi,$sources,$studs),
            'jumlah_jobseeker'=>(int)$q->fetchColumn(),'tidak_terverifikasi'=>$ditolak,'min_mahasiswa'=>MIN_MHS]);
    }
    if($action==='logout'){ $_SESSION=[]; session_destroy(); jsonResponse(['success'=>true]); }
    if($action==='me'){
        if(empty($_SESSION['user_id'])) jsonResponse(['success'=>false,'message'=>'Belum login.'],401);
        $q=db()->prepare('SELECT id,name,email,instansi,role,jalur,prodi FROM users WHERE id=? LIMIT 1');
        $q->execute([(int)$_SESSION['user_id']]); $u=$q->fetch();
        if(!$u) jsonResponse(['success'=>false,'message'=>'User tidak ditemukan.'],404);
        jsonResponse(['success'=>true,'user'=>$u]);
    }
    jsonResponse(['success'=>false,'message'=>'Action API tidak dikenal.'],404);
} catch(Throwable $e) {
    error_log($e->getMessage());
    if(str_contains($e->getMessage(),"Unknown column 'tampil'")||str_contains($e->getMessage(),"Unknown column 'p.tampil'")||str_contains($e->getMessage(),"lamaran' doesn't exist"))
        jsonResponse(['success'=>false,'message'=>'Database perlu diperbarui: jalankan database/migrasi_lamaran.sql di phpMyAdmin.'],500);
    if(str_contains($e->getMessage(),'lowongan_kerja')||str_contains($e->getMessage(),"Unknown column 'jenis'")||str_contains($e->getMessage(),"Unknown column 'level'"))
        jsonResponse(['success'=>false,'message'=>'Database perlu diperbarui: jalankan database/migrasi_lowongan.sql di phpMyAdmin.'],500);
    if(str_contains($e->getMessage(),"Unknown column 'bahasa'")||str_contains($e->getMessage(),"Unknown column 'p.bahasa'"))
        jsonResponse(['success'=>false,'message'=>'Database perlu diperbarui: jalankan database/migrasi_bahasa.sql di phpMyAdmin.'],500);
    jsonResponse(['success'=>false,'message'=>'Database/server error. Periksa php/config.php dan MySQL.'],500);
}
