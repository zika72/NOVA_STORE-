<?php
declare(strict_types=1);

/*
 * NOVA STORE — Paiement Wave MANUEL
 *
 * Ce serveur ne demande PAS de Wave Business/API.
 * Le client reçoit ton numéro Wave, effectue le transfert manuellement,
 * puis signale le paiement. L'administration vérifie ensuite le paiement.
 *
 * Routes:
 * POST /api/create-order
 * POST /api/mark-paid
 * GET  /api/order?id=...
 * GET  /health
 *
 * Routes ADMIN (protégées par mot de passe, header X-Admin-Key):
 * GET  /api/admin/orders
 * POST /api/admin/update-status
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function loadEnv(string $file): array {
    if (!is_file($file)) {
        http_response_code(500);
        echo json_encode(['error' => 'Le fichier .env est introuvable.']);
        exit;
    }

    $env = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        if (strlen($value) >= 2) {
            $first = $value[0];
            $last = substr($value, -1);
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        $env[$key] = $value;
    }

    return $env;
}

$ENV = loadEnv(__DIR__ . '/.env');

function jsonResponse(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function input(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        jsonResponse(['error' => 'Données JSON invalides.'], 400);
    }
    return $data;
}

function products(): array {
    return [
        1  => ['name' => '100 000 Argent RP', 'price' => 1000],
        2  => ['name' => '200 000 Argent RP', 'price' => 2000],
        3  => ['name' => '300 000 Argent RP', 'price' => 3000],
        4  => ['name' => '400 000 Argent RP', 'price' => 4000],
        5  => ['name' => '500 000 Argent RP', 'price' => 5000],
        6  => ['name' => '600 000 Argent RP', 'price' => 6000],
        7  => ['name' => '700 000 Argent RP', 'price' => 7000],
        8  => ['name' => '800 000 Argent RP', 'price' => 8000],
        9  => ['name' => '900 000 Argent RP', 'price' => 9000],
        10 => ['name' => '1 000 000 Argent RP', 'price' => 10000],
        11 => ['name' => 'VIP Fer', 'price' => 2000],
        12 => ['name' => 'VIP Bronze', 'price' => 5000],
        13 => ['name' => 'VIP Haut de gamme', 'price' => 10000],
    ];
}

function promoCodes(): array {
    // Exemple:
    // return ['NOVA10' => 10];
    return [];
}

function ordersFile(): string {
    return __DIR__ . '/orders.json';
}

function readOrders(): array {
    $file = ordersFile();

    if (!is_file($file)) {
        return [];
    }

    $json = file_get_contents($file);
    $data = json_decode($json ?: '[]', true);

    return is_array($data) ? $data : [];
}

function writeOrders(array $orders): void {
    $file = ordersFile();
    $tmp = $file . '.tmp';

    $json = json_encode(
        $orders,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        jsonResponse(['error' => "Impossible d'enregistrer la commande."], 500);
    }

    if (!rename($tmp, $file)) {
        @unlink($tmp);
        jsonResponse(['error' => "Impossible de finaliser l'enregistrement."], 500);
    }
}

function calculateOrder(array $items, string $promo): array {
    $catalog = products();

    if (!$items) {
        jsonResponse(['error' => 'Le panier est vide.'], 422);
    }

    $cleanItems = [];
    $subtotal = 0;

    foreach ($items as $item) {
        $id = (int)($item['id'] ?? 0);
        $quantity = (int)($item['quantity'] ?? 0);

        if (!isset($catalog[$id])) {
            jsonResponse(['error' => 'Produit invalide.'], 422);
        }

        if ($quantity < 1 || $quantity > 100) {
            jsonResponse(['error' => 'Quantité invalide.'], 422);
        }

        $product = $catalog[$id];
        $lineTotal = $product['price'] * $quantity;
        $subtotal += $lineTotal;

        $cleanItems[] = [
            'id' => $id,
            'name' => $product['name'],
            'quantity' => $quantity,
            'unit_price' => $product['price'],
            'line_total' => $lineTotal,
        ];
    }

    $promo = strtoupper(trim($promo));
    $discount = 0;

    if ($promo !== '') {
        $codes = promoCodes();

        if (!isset($codes[$promo])) {
            jsonResponse(['error' => 'Code promo invalide.'], 422);
        }

        $discount = (int)floor($subtotal * ((int)$codes[$promo]) / 100);
    }

    $total = max(0, $subtotal - $discount);

    if ($total <= 0) {
        jsonResponse(['error' => 'Montant invalide.'], 422);
    }

    return [
        'items' => $cleanItems,
        'subtotal' => $subtotal,
        'discount' => $discount,
        'total' => $total,
        'promo' => $promo,
    ];
}

function createOrder(array $env): never {
    $data = input();

    $email = trim((string)($data['email'] ?? ''));
    $phone = trim((string)($data['phone'] ?? ''));
    $promo = (string)($data['promo'] ?? '');
    $items = $data['items'] ?? [];

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Adresse e-mail invalide.'], 422);
    }

    // Le numéro du client sert uniquement à identifier son contact.
    if (!preg_match('/^\d{8,15}$/', $phone)) {
        jsonResponse(['error' => 'Numéro de téléphone invalide.'], 422);
    }

    $order = calculateOrder($items, $promo);

    $id = 'NS-' . strtoupper(bin2hex(random_bytes(5)));
    $now = date('c');

    $record = [
        'id' => $id,
        'email' => $email,
        'customer_phone' => $phone,
        'items' => $order['items'],
        'subtotal' => $order['subtotal'],
        'discount' => $order['discount'],
        'promo' => $order['promo'],
        'total' => $order['total'],
        'currency' => $env['CURRENCY'] ?? 'XOF',
        'payment_method' => 'Wave manuel',
        'wave_number' => $env['WAVE_NUMBER'] ?? '',
        'status' => 'pending_payment',
        'created_at' => $now,
        'updated_at' => $now,
    ];

    if ($record['wave_number'] === '' || $record['wave_number'] === 'TON_NUMERO_WAVE_ICI') {
        jsonResponse(['error' => 'Configure ton WAVE_NUMBER dans le fichier .env.'], 500);
    }

    $orders = readOrders();
    $orders[] = $record;
    writeOrders($orders);

    jsonResponse([
        'success' => true,
        'order_id' => $id,
        'total' => $order['total'],
        'currency' => $record['currency'],
        'wave_number' => $record['wave_number'],
        'status' => $record['status'],
    ]);
}

function markPaid(): never {
    $data = input();
    $id = trim((string)($data['order_id'] ?? ''));

    if ($id === '') {
        jsonResponse(['error' => 'ID de commande manquant.'], 422);
    }

    $orders = readOrders();

    foreach ($orders as &$order) {
        if (($order['id'] ?? '') === $id) {
            if (($order['status'] ?? '') === 'paid') {
                jsonResponse(['success' => true, 'status' => 'paid']);
            }

            $order['status'] = 'payment_to_verify';
            $order['updated_at'] = date('c');
            writeOrders($orders);

            jsonResponse([
                'success' => true,
                'status' => 'payment_to_verify',
                'message' => 'Paiement signalé. Vérification manuelle nécessaire.'
            ]);
        }
    }

    jsonResponse(['error' => 'Commande introuvable.'], 404);
}

function getOrder(): never {
    $id = trim((string)($_GET['id'] ?? ''));

    if ($id === '') {
        jsonResponse(['error' => 'ID de commande manquant.'], 422);
    }

    foreach (readOrders() as $order) {
        if (($order['id'] ?? '') === $id) {
            // Ne renvoie pas d'informations inutiles.
            jsonResponse([
                'success' => true,
                'order' => [
                    'id' => $order['id'],
                    'total' => $order['total'],
                    'currency' => $order['currency'],
                    'status' => $order['status'],
                    'created_at' => $order['created_at'],
                    'updated_at' => $order['updated_at'],
                ]
            ]);
        }
    }

    jsonResponse(['error' => 'Commande introuvable.'], 404);
}

function requireAdmin(array $env): void {
    $expected = (string)($env['ADMIN_PASSWORD'] ?? '');

    if ($expected === '' || $expected === 'CHANGE_MOI_MOT_DE_PASSE_ADMIN') {
        jsonResponse(['error' => "Configure ADMIN_PASSWORD dans le fichier .env avant d'utiliser l'admin."], 500);
    }

    $given = (string)($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');

    if ($given === '' || !hash_equals($expected, $given)) {
        jsonResponse(['error' => 'Accès admin refusé.'], 401);
    }
}

function listOrdersAdmin(array $env): never {
    requireAdmin($env);

    $orders = readOrders();
    // Les plus récentes en premier.
    $orders = array_reverse($orders);

    jsonResponse(['success' => true, 'orders' => $orders]);
}

function updateOrderStatus(array $env): never {
    requireAdmin($env);

    $data = input();
    $id = trim((string)($data['order_id'] ?? ''));
    $status = trim((string)($data['status'] ?? ''));

    $allowed = ['pending_payment', 'payment_to_verify', 'paid', 'rejected'];

    if ($id === '' || !in_array($status, $allowed, true)) {
        jsonResponse(['error' => 'Requête invalide.'], 422);
    }

    $orders = readOrders();
    $found = false;

    foreach ($orders as &$order) {
        if (($order['id'] ?? '') === $id) {
            $order['status'] = $status;
            $order['updated_at'] = date('c');
            $found = true;
            break;
        }
    }
    unset($order);

    if (!$found) {
        jsonResponse(['error' => 'Commande introuvable.'], 404);
    }

    writeOrders($orders);

    jsonResponse(['success' => true, 'status' => $status]);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($scriptDir && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
    $path = substr($path, strlen($scriptDir)) ?: '/';
}

/*
 * Avec cette structure:
 * serveur/
 *   app.php
 *   .env
 *   script.js
 *
 * Le JavaScript appelle:
 *   app.php/api/create-order
 */
try {
    if ($method === 'POST' && $path === '/api/create-order') {
        createOrder($ENV);
    }

    if ($method === 'POST' && $path === '/api/mark-paid') {
        markPaid();
    }

    if ($method === 'GET' && $path === '/api/order') {
        getOrder();
    }

    if ($method === 'GET' && $path === '/health') {
        jsonResponse(['success' => true, 'service' => 'NOVA STORE']);
    }

    if ($method === 'GET' && $path === '/api/admin/orders') {
        listOrdersAdmin($ENV);
    }

    if ($method === 'POST' && $path === '/api/admin/update-status') {
        updateOrderStatus($ENV);
    }

    jsonResponse(['error' => 'Route introuvable.'], 404);
} catch (Throwable $e) {
    error_log('[NOVA STORE] ' . $e->getMessage());
    jsonResponse(['error' => 'Erreur interne du serveur.'], 500);
}
?>
