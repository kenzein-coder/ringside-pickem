# Example Wrestler Image URLs

## Current Image Sources in the App

### 1. Cagematch.net Images (Most Reliable - Already Scraped)
These are the images that your scraper already extracts and saves to Firestore:

**Example Cagematch URLs:**
- `https://www.cagematch.net/site/main/img/wrestler/4324.jpg` (Josh Alexander)
- `https://www.cagematch.net/site/main/img/wrestler/18237.jpg` (Jordynne Grace)
- `https://www.cagematch.net/site/main/img/wrestler/15978.jpg` (Nic Nemeth)

**Note:** These URLs are automatically proxied through `wsrv.nl` to avoid CORS issues:
- Proxied URL: `https://wsrv.nl/?url=https://www.cagematch.net/site/main/img/wrestler/4324.jpg&w=400&h=500&fit=cover&a=attention`

### 2. Hardcoded Wikimedia URLs (Currently Failing - 404)
These are in the `WRESTLER_IMAGES` object but many are returning 404:

**Example Wikimedia URLs:**
- `https://upload.wikimedia.org/wikipedia/commons/1/1e/Dolph_Ziggler_2017.jpg` (Nic Nemeth) - **404 Error**
- `https://upload.wikimedia.org/wikipedia/commons/6/6a/Zack_Sabre_Jr_2018.jpg` (Zack Sabre Jr.) - **404 Error**
- `https://upload.wikimedia.org/wikipedia/commons/b/b3/Josh_Alexander_Impact_Wrestling.jpg` (Josh Alexander) - **404 Error**

**Note:** These are automatically proxied, but still fail because the source URLs are broken.

### 3. Working Example URLs You Can Test

**Cagematch (with proxy):**
```
https://wsrv.nl/?url=https://www.cagematch.net/site/main/img/wrestler/4324.jpg&w=400&h=500&fit=cover&a=attention
```

**Alternative proxy service:**
```
https://images.weserv.nl/?url=https://www.cagematch.net/site/main/img/wrestler/4324.jpg&w=400&h=500&fit=cover&a=attention
```

## How to Find More Cagematch Image URLs

1. **From your scraped data:** Check `data/events-with-details.json` for `p1Image` and `p2Image` fields
2. **From Cagematch directly:** Visit `https://www.cagematch.net/?id=2&nr={WRESTLER_ID}` and find the image URL
3. **Pattern:** Cagematch images follow: `https://www.cagematch.net/site/main/img/wrestler/{ID}.jpg`

## Testing Image URLs

You can test if an image URL works by:
1. Opening it directly in a browser
2. Using curl: `curl -I "URL"`
3. Checking the browser console when the app tries to load it

## Current Status

✅ **Working:** Cagematch images (when proxied)
❌ **Not Working:** Most Wikimedia URLs (404 errors)
⚠️ **Experimental:** OWOW, Unsplash fallbacks

The app now prioritizes Cagematch images from Firestore, which should be the most reliable source.


