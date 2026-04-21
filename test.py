from dotenv import load_dotenv
import os, requests

load_dotenv()
key = os.environ.get("TMDB_API_KEY")

r = requests.get(
    "https://api.themoviedb.org/3/movie/popular",
    params={"api_key": key, "language": "en-US"},
    verify=False  # temporarily disable SSL
)
print("Status:", r.status_code)
print("First movie:", r.json().get("results", [{}])[0].get("title", "None"))