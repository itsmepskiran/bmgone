<?php
require_once __DIR__ . '/db.php';

$payload = json_decode(file_get_contents('php://input'), true);

if (!$payload || empty($payload['name']) || empty($payload['phone'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name and phone are required']);
    exit;
}

try {
    $pdo->beginTransaction();

    $statement = $pdo->prepare(
        'INSERT INTO insurance_quote_requests
        (insurance_type, customer_name, phone, email, city, age, eldest_age, children_count, annual_income, plan_type, coverage, nominee, nominee_relationship, members_json, requirements, lowest_annual_premium)
        VALUES
        (:insurance_type, :customer_name, :phone, :email, :city, :age, :eldest_age, :children_count, :annual_income, :plan_type, :coverage, :nominee, :nominee_relationship, :members_json, :requirements, :lowest_annual_premium)'
    );

    $statement->execute([
        ':insurance_type' => $payload['insuranceType'] ?? 'health',
        ':customer_name' => $payload['name'],
        ':phone' => $payload['phone'],
        ':email' => $payload['email'] ?? null,
        ':city' => $payload['city'] ?? '',
        ':age' => !empty($payload['age']) ? $payload['age'] : null,
        ':eldest_age' => !empty($payload['eldestAge']) ? $payload['eldestAge'] : null,
        ':children_count' => $payload['childrenCount'] ?? null,
        ':annual_income' => $payload['income'] ?? null,
        ':plan_type' => $payload['planType'] ?? null,
        ':coverage' => $payload['coverage'] ?? null,
        ':nominee' => $payload['nominee'] ?? null,
        ':nominee_relationship' => $payload['relationship'] ?? null,
        ':members_json' => json_encode($payload['members'] ?? []),
        ':requirements' => $payload['requirements'] ?? null,
        ':lowest_annual_premium' => $payload['lowestPremium'] ?? 0,
    ]);

    $quoteRequestId = $pdo->lastInsertId();
    $policyStatement = $pdo->prepare(
        'INSERT INTO insurance_policy_quotes
        (quote_request_id, provider, plan_name, cover_amount, annual_premium, match_reason, features_json, rank_order)
        VALUES
        (:quote_request_id, :provider, :plan_name, :cover_amount, :annual_premium, :match_reason, :features_json, :rank_order)'
    );

    foreach (($payload['policies'] ?? []) as $index => $policy) {
        $policyStatement->execute([
            ':quote_request_id' => $quoteRequestId,
            ':provider' => $policy['provider'] ?? '',
            ':plan_name' => $policy['plan'] ?? '',
            ':cover_amount' => $policy['cover'] ?? '',
            ':annual_premium' => $policy['premium'] ?? 0,
            ':match_reason' => $policy['match'] ?? null,
            ':features_json' => json_encode($policy['features'] ?? []),
            ':rank_order' => $index + 1,
        ]);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'quoteRequestId' => $quoteRequestId,
    ]);
} catch (Exception $exception) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to save quote',
        'error' => $exception->getMessage(),
    ]);
}
