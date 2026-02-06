# Decathlon NPS Score

Chrome extension that adds NPS-like scores to Decathlon product pages.

## What it does

**Product Listing Pages (PLP/Search):**
- Fetches review stats for each product card via Decathlon's API
- Displays a colored score badge next to the star rating
- Color gradient from red (poor) → yellow → green (excellent) based on NPS %

**Product Detail Pages (PDP):**
- NPS score badge next to the star rating
- Review insights panel: recommendation %, attribute ratings with colored bars
- Fit distribution breakdown replacing the default sizometer

## Score Calculation

- **NPS** = (5-star % − 1-star %) of all reviews
- **Score** = (5★ − 1★)² / total reviews — rewards both quality and volume

## Install

1. Clone this repo
2. Go to `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select this folder
