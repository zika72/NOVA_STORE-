
<?php

// 1. Clé API secrète : à configurer côté serveur
$api_key = getenv("WAVE_API_KEY");

if (!$api_key) {
    http_response_code(500);
    exit("Configuration Wave manquante.");
}

// 2. Informations de la session de paiement
$checkout_params = [
    "amount" => "2000",
    "currency" => "XOF",
    "client_reference" => "NOVA-TEST-001",
    "success_url" => "https://ton-site.com/succes.php",
    "error_url" => "https://ton-site.com/echec.php"
];

// 3. Préparer la requête vers Wave
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL =>
        "https://api.wave.com/v1/checkout/sessions",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($checkout_params),
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . $api_key,
        "Content-Type: application/json"
    ]
]);

// 4. Envoyer la requête
$response = curl_exec($curl);
$error = curl_error($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);

curl_close($curl);

// 5. Gérer les erreurs réseau
if ($response === false) {
    http_response_code(502);
    exit("Erreur de connexion à Wave.");
}

// 6. Lire la réponse JSON
$data = json_decode($response, true);

if ($status < 200 || $status >= 300 ||
    !is_array($data) ||
    empty($data["wave_launch_url"])) {
    http_response_code(502);
    exit("La session Wave n'a pas pu être créée.");
}

// 7. Rediriger le client vers le paiement Wave
header("Location: " . $data["wave_launch_url"], true, 303);
exit;
