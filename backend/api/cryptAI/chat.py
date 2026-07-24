from google import genai
from google.genai.types import HttpOptions
from dotenv import load_dotenv
import os

_client = None

def get_client():
    global _client
    if _client is None:
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(
            http_options=HttpOptions(api_version="v1"),
            api_key=api_key,
        )
    return _client


def query_with_code(message: str, code: str) -> str:
    client = get_client()

    query_context = (
        "You are a crypto trading strategy reviewer. "
        "Analyse the code, explain risks, edge assumptions, and suggest improvements. "
        "Provide headings in double astrix for clarity. e.g. **heading**. "
        "Do NOT give financial advice or tell the user to buy/sell.\n\n"
        f"User question:\n{message}\n\n"
        "Strategy code:\n```python\n"
        f"{code}\n```"
    )

    response = client.models.generate_content(
        model="models/gemini-2.5-flash-lite",  # <-- replace with the exact name from list()
        contents=[query_context],
    )

    return response.text


def query_with_market(message: str) -> str:
    client = get_client()

    query_context = (
        "You are a crypto market explainer. "
        "You may describe price action and risk factors, "
        "but do NOT give financial advice or explicit buy/sell instructions. "
        "Provide headings in double astrix for clarity. e.g. **heading**. "
        "Politely refuse to answer any queries that are not relevant to crypto markets.\n\n"
        f"User question:\n{message}\n"
    )

    response = client.models.generate_content(
        model="models/gemini-2.5-flash-lite",  # or keep gemini-2.5-flash if you prefer
        contents=[query_context],
    )

    return response.text