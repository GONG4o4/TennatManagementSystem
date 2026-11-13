<?php

declare(strict_types=1);

final class HitPayService
{
    private static function getApiUrl(): string
    {
        $mode = appEnv('HITPAY_MODE', 'sandbox');
        return $mode === 'live'
            ? 'https://api.hit-pay.com/v1'
            : 'https://api.sandbox.hit-pay.com/v1';
    }

    public static function createPaymentRequest(array $params): array
    {
        $apiKey = appEnv('HITPAY_API_KEY');
        if ($apiKey === '') {
            throw new ApiException(500, 'HitPay payment gateway is not configured. Missing API key.');
        }

        $currency = appEnv('HITPAY_CURRENCY', 'PHP');
        $frontendUrl = appEnv('APP_FRONTEND_URL', 'http://localhost:5175');

        $payload = [
            'amount' => number_format((float) $params['amount'], 2, '.', ''),
            'currency' => $currency,
            'purpose' => $params['purpose'] ?? 'Rent Invoice Payment',
            'redirect_url' => $params['redirect_url'] ?? ($frontendUrl . '/tenant/payments'),
            'webhook' => $params['webhook'] ?? '',
            'reference_number' => (string) ($params['reference_number'] ?? ''),
        ];

        if (!empty($params['email'])) {
            $payload['email'] = $params['email'];
        }
        if (!empty($params['name'])) {
            $payload['name'] = $params['name'];
        }

        // Post to HitPay API
        $url = self::getApiUrl() . '/payment-requests';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-BUSINESS-API-KEY: ' . $apiKey,
            'Content-Type: application/x-www-form-urlencoded',
            'X-Requested-With: XMLHttpRequest',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError !== '') {
            throw new ApiException(502, 'Failed to connect to HitPay payment gateway: ' . $curlError);
        }

        $json = json_decode((string) $response, true);
        if ($httpCode < 200 || $httpCode >= 300 || empty($json['url'])) {
            $msg = $json['message'] ?? (is_array($json) ? json_encode($json) : 'Payment request creation failed');
            throw new ApiException(502, 'HitPay error: ' . $msg);
        }

        return $json;
    }

    public static function getPaymentRequestStatus(string $paymentRequestId): array
    {
        $apiKey = appEnv('HITPAY_API_KEY');
        if ($apiKey === '') {
            throw new ApiException(500, 'HitPay payment gateway is not configured.');
        }

        $url = self::getApiUrl() . '/payment-requests/' . urlencode($paymentRequestId);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-BUSINESS-API-KEY: ' . $apiKey,
            'X-Requested-With: XMLHttpRequest',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError !== '') {
            throw new ApiException(502, 'Failed to verify HitPay payment: ' . $curlError);
        }

        $json = json_decode((string) $response, true);
        if ($httpCode !== 200 || !is_array($json)) {
            throw new ApiException(502, 'Failed to retrieve HitPay payment status.');
        }

        return $json;
    }
}
