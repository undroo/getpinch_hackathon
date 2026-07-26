from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    pinch_merchant_id: str = Field(
        default="",
        validation_alias=AliasChoices("PINCH_MERCHANT_ID", "PINCH_APPLICATION_ID"),
    )
    pinch_api_key: str = ""
    pinch_publishable_key: str = ""
    pinch_base_url: str = "https://api.getpinch.com.au/test"
    pinch_standard_plan_id: str = ""
    pinch_hold_plan_id: str = ""
    pinch_payer_sarah: str = ""
    pinch_payer_marcus: str = ""
    pinch_payer_avery: str = ""
    pinch_webhook_secret: str = ""
    cors_origins: str = "http://localhost:3000"
    demo_gym_name: str = "RetainIQ+ Demo Gym"
    web_app_url: str = "http://localhost:3000"

    def offer_url(self, token: str) -> str:
        base = self.web_app_url.rstrip("/")
        return f"{base}/offer/{token}"

    def offer_return_url(self, token: str) -> str:
        return f"{self.offer_url(token)}/complete"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def pinch_configured(self) -> bool:
        return bool(self.pinch_merchant_id and self.pinch_api_key)


settings = Settings()
