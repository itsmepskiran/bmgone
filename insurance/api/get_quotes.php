<?php
require_once __DIR__ . '/db.php';

$type = $_GET['type'] ?? 'health';

try {
    $statement = $pdo->prepare(
        'SELECT id, insurance_type, customer_name, phone, email, city, age, eldest_age, children_count, annual_income, plan_type, coverage, nominee, nominee_relationship, members_json, requirements, lowest_annual_premium, created_at
         FROM insurance_quote_requests
         WHERE insurance_type = :insurance_type
         ORDER BY created_at DESC
         LIMIT 50'
    );

    $statement->execute([':insurance_type' => $type]);
    $quotes = $statement->fetchAll();

    echo json_encode([
        'success' => true,
        'quotes' => $quotes,
    ]);
} catch (Exception $exception) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to fetch quotes',
        'error' => $exception->getMessage(),
    ]);
}
