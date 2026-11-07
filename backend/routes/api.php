<?php

declare(strict_types=1);

function dispatchApi(PDO $pdo, string $method, string $path): array
{
    $user = null;

    if ($method === 'GET' && $path === '/api/health') {
        return ['status' => 200, 'body' => ['status' => 'ok', 'message' => 'API is running']];
    }

    if ($method === 'POST' && $path === '/api/auth/register') {
        return authRegister($pdo, requestJson());
    }

    if ($method === 'POST' && $path === '/api/auth/login') {
        return authLogin($pdo, requestJson());
    }

    if ($method === 'POST' && $path === '/api/auth/password') {
        return authChangePassword($pdo, authenticatedUser($pdo), requestJson());
    }

    $user = authenticatedUser($pdo);

    if ($method === 'GET' && $path === '/api/profile') {
        return profileGet($pdo, $user);
    }

    if ($method === 'GET' && $path === '/api/landlords') {
        return landlordDirectoryList($pdo, $user);
    }

    if ($method === 'PATCH' && $path === '/api/profile') {
        return profilePatch($pdo, $user, requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/properties') {
        return propertyList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/properties') {
        return propertyCreate($pdo, $user, requestJson());
    }

    if ($method === 'PUT' && preg_match('#^/api/properties/(\d+)$#', $path, $matches) === 1) {
        return propertyUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/units') {
        return unitList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/units') {
        return unitCreate($pdo, $user, requestJson());
    }

    if ($method === 'PUT' && preg_match('#^/api/units/(\d+)$#', $path, $matches) === 1) {
        return unitUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/units/(\d+)/images$#', $path, $matches) === 1) {
        return unitImagesCreate($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && $path === '/api/applications') {
        return applicationList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/applications') {
        return applicationCreate($pdo, $user, requestJson());
    }

    if ($method === 'PATCH' && preg_match('#^/api/applications/(\d+)/status$#', $path, $matches) === 1) {
        return applicationStatusUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && preg_match('#^/api/applications/(\d+)/documents$#', $path, $matches) === 1) {
        return applicationDocumentsList($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'POST' && preg_match('#^/api/applications/(\d+)/documents$#', $path, $matches) === 1) {
        return applicationDocumentCreate($pdo, $user, (int) $matches[1], requestJson());
    }

    if ($method === 'PATCH' && preg_match('#^/api/documents/(\d+)/verification$#', $path, $matches) === 1) {
        return applicationDocumentVerificationUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/screening-criteria') {
        return screeningCriteriaList($pdo, $user);
    }

    if ($method === 'GET' && $path === '/api/screenings') {
        return screeningList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/screening-criteria') {
        return screeningCriterionCreate($pdo, $user, requestJson());
    }

    if ($method === 'PUT' && preg_match('#^/api/screening-criteria/(\d+)$#', $path, $matches) === 1) {
        return screeningCriterionUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/applications/(\d+)/screenings$#', $path, $matches) === 1) {
        return screeningCreate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/screenings/(\d+)/results$#', $path, $matches) === 1) {
        return screeningResultCreate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/leases') {
        return leaseList($pdo, $user);
    }

    if ($method === 'GET' && $path === '/api/rental-regulations') {
        return rentalRegulationList($pdo, $user);
    }

    if ($method === 'GET' && preg_match('#^/api/leases/(\d+)/agreement$#', $path, $matches) === 1) {
        return leaseAgreementDataGet($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && preg_match('#^/api/leases/(\d+)/deposit$#', $path, $matches) === 1) {
        return leaseDepositGet($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'PATCH' && preg_match('#^/api/leases/(\d+)/deposit$#', $path, $matches) === 1) {
        return leaseDepositUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/leases/(\d+)/deposit/deductions$#', $path, $matches) === 1) {
        return leaseDepositDeductionCreate($pdo, $user, (int) $matches[1], requestJson());
    }

    if ($method === 'GET' && preg_match('#^/api/leases/(\d+)/rent-increases$#', $path, $matches) === 1) {
        return leaseRentIncreaseList($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'POST' && preg_match('#^/api/leases/(\d+)/rent-increases$#', $path, $matches) === 1) {
        return leaseRentIncreaseCreate($pdo, $user, (int) $matches[1], requestJson());
    }

    if ($method === 'GET' && preg_match('#^/api/leases/(\d+)/notices$#', $path, $matches) === 1) {
        return leaseNoticeList($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'POST' && preg_match('#^/api/leases/(\d+)/notices$#', $path, $matches) === 1) {
        return leaseNoticeCreate($pdo, $user, (int) $matches[1], requestJson());
    }

    if ($method === 'POST' && $path === '/api/leases') {
        return leaseCreate($pdo, $user, requestJson());
    }

    if ($method === 'PUT' && preg_match('#^/api/leases/(\d+)$#', $path, $matches) === 1) {
        return leaseUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/invoices') {
        return invoiceList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/invoices') {
        return invoiceCreate($pdo, $user, requestJson());
    }

    if ($method === 'PATCH' && preg_match('#^/api/invoices/(\d+)/status$#', $path, $matches) === 1) {
        return invoiceStatusUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/invoices/(\d+)/verify$#', $path, $matches) === 1) {
        return invoiceVerify($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/payments/methods') {
        return paymentMethodsList();
    }

    if ($method === 'GET' && $path === '/api/payments') {
        return paymentList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/payments/initiate') {
        return paymentInitiate($pdo, $user, requestJson());
    }

    if ($method === 'POST' && preg_match('#^/api/payments/(\d+)/confirm$#', $path, $matches) === 1) {
        return paymentConfirm($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'POST' && preg_match('#^/api/payments/(\d+)/cancel$#', $path, $matches) === 1) {
        return paymentAttemptCancel($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'POST' && preg_match('#^/api/payments/(\d+)/refund$#', $path, $matches) === 1) {
        return paymentRefund($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && preg_match('#^/api/payments/(\d+)/status$#', $path, $matches) === 1) {
        return paymentStatusGet($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && preg_match('#^/api/payments/(\d+)/receipt$#', $path, $matches) === 1) {
        return paymentReceiptGet($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && $path === '/api/expenses') {
        return expenseList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/expenses') {
        return expenseCreate($pdo, $user, requestJson());
    }

    if ($method === 'DELETE' && preg_match('#^/api/expenses/(\d+)$#', $path, $matches) === 1) {
        return expenseDelete($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && $path === '/api/expenses/summary') {
        return expenseSummary($pdo, $user);
    }

    if ($method === 'GET' && $path === '/api/maintenance') {
        return maintenanceList($pdo, $user);
    }

    if ($method === 'POST' && $path === '/api/maintenance') {
        return maintenanceCreate($pdo, $user, requestJson());
    }

    if ($method === 'PATCH' && preg_match('#^/api/maintenance/(\d+)/status$#', $path, $matches) === 1) {
        return maintenanceStatusUpdate($pdo, $user, (int) $matches[1], requestJsonOrEmpty());
    }

    if ($method === 'GET' && $path === '/api/notifications') {
        return notificationsList($pdo, $user);
    }

    if ($method === 'PATCH' && preg_match('#^/api/notifications/(\d+)/read$#', $path, $matches) === 1) {
        return notificationMarkRead($pdo, $user, (int) $matches[1]);
    }

    if ($method === 'GET' && $path === '/api/audit-log') {
        return auditLogList($pdo, $user);
    }

    throw new ApiException(404, 'API route not found.');
}
