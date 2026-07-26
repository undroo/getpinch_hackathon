from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import settings

AUTH_URL = "https://auth.getpinch.com.au/connect/token"
PINCH_VERSION = "2020.1"


class PinchAuthError(Exception):
    """Raised when OAuth token exchange fails."""


class PinchClient:
    def __init__(self) -> None:
        self.base_url = settings.pinch_base_url.rstrip("/")
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        client_id = settings.pinch_merchant_id
        client_secret = settings.pinch_api_key
        if not client_id or not client_secret:
            raise PinchAuthError(
                "PINCH_MERCHANT_ID and PINCH_API_KEY must both be set for live Pinch calls"
            )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                AUTH_URL,
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials", "scope": "api1"},
                timeout=30.0,
            )
            if response.status_code >= 400:
                raise PinchAuthError(
                    f"Pinch OAuth failed ({response.status_code}): {response.text}"
                )
            payload = response.json()
            token = payload.get("access_token")
            if not token:
                raise PinchAuthError("Pinch OAuth response missing access_token")
            expires_in = int(payload.get("expires_in", 3600))
            self._access_token = str(token)
            self._token_expires_at = time.time() + expires_in
            return self._access_token

    async def _headers(self) -> dict[str, str]:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "pinch-version": PINCH_VERSION,
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json,
                params=params,
                timeout=30.0,
            )
            if response.status_code >= 400:
                detail = response.text.strip() or response.reason_phrase
                raise httpx.HTTPStatusError(
                    f"Pinch {method} {path} failed ({response.status_code}): {detail}",
                    request=response.request,
                    response=response,
                )
            if response.content:
                data = response.json()
                return data if isinstance(data, dict) else {"data": data}
            return {}

    async def list_plans(self, *, page: int = 1, page_size: int = 50) -> dict:
        return await self._request(
            "GET",
            "/plans",
            params={"page": page, "pageSize": page_size},
        )

    async def list_payers(self, *, page: int = 1, page_size: int = 50) -> dict:
        return await self._request(
            "GET",
            "/payers",
            params={"page": page, "pageSize": page_size},
        )

    async def create_plan(self, payload: dict[str, Any]) -> dict:
        return await self._request("POST", "/plans", json=payload)

    async def create_payer(self, payload: dict[str, Any]) -> dict:
        return await self._request("POST", "/payers", json=payload)

    async def list_payer_subscriptions(self, payer_id: str) -> dict:
        return await self._request("GET", f"/subscriptions/payer/{payer_id}")

    async def preview_plan_payments(
        self, plan_id: str, total_amount: int | None = None
    ) -> dict:
        params: dict[str, Any] = {}
        if total_amount is not None:
            params["totalAmount"] = total_amount
        return await self._request(
            "GET",
            f"/plans/{plan_id}/calculated-payments",
            params=params,
        )

    async def cancel_subscription(self, subscription_id: str) -> None:
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/subscriptions/{subscription_id}",
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()

    async def create_subscription(
        self,
        *,
        plan_id: str,
        payer_id: str,
        total_amount: int | None = None,
    ) -> dict:
        payload: dict[str, Any] = {"planId": plan_id, "payerId": payer_id}
        if total_amount is not None:
            payload["totalAmount"] = total_amount
        return await self._request("POST", "/subscriptions", json=payload)

    async def create_payment_link(
        self,
        *,
        amount_cents: int,
        description: str,
        return_url: str,
        payer_id: str | None = None,
        allowed_payment_methods: list[str] | None = None,
        metadata: str | None = None,
        payment_date: str | None = None,
    ) -> dict:
        methods = allowed_payment_methods or ["credit-card", "bank-account"]
        payload: dict[str, Any] = {
            "amount": amount_cents,
            "description": description,
            "returnUrl": return_url,
            "allowedPaymentMethods": methods,
        }
        if payer_id:
            payload["payerId"] = payer_id
        if metadata:
            payload["metadata"] = metadata
        # Spike: Pinch Payment Links docs omit a due-date field; hosted checkout
        # still shows N/A when these are sent (verified via spike_payment_link_date.py).
        if payment_date:
            payload["transactionDate"] = payment_date
            payload["paymentDate"] = payment_date
            payload["scheduledDate"] = payment_date
        return await self._request("POST", "/payment-links", json=payload)

    async def create_payer_source(
        self,
        payer_id: str,
        *,
        token: str,
        source_type: str,
        ip_address: str = "127.0.0.1",
    ) -> dict:
        return await self._request(
            "POST",
            f"/payers/{payer_id}/sources",
            json={
                "token": token,
                "sourceType": source_type,
                "ipAddress": ip_address,
            },
        )
