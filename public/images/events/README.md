# Adding Custom Event Posters/Banners

You can add your own event poster/banner images to this folder, and they will be automatically used by the application.

## How to Add Event Posters

1. **Place your poster files** in this directory: `public/images/events/`

2. **Name your files** using either:
   - **Event ID** (recommended): `{event-id}.{ext}`
     - Example: `wwe-survivor-2025.jpg`
   - **Event Name** (sanitized): `{event-name}.{ext}`
     - Example: `survivor-series-2025.jpg` or `wrestle-kingdom-20.jpg`
     - Spaces and special characters are replaced with hyphens

3. **Supported file formats:**
   - `.jpg` or `.jpeg` (JPEG - recommended for photos/posters)
   - `.png` (Portable Network Graphics)
   - `.webp` (WebP - modern, efficient format)

4. **File naming examples:**
   ```
   public/images/events/wwe-survivor-2025.jpg
   public/images/events/aew-worlds-end-2025.png
   public/images/events/njpw-wk20.jpg
   public/images/events/survivor-series-2025.jpg
   ```

## Priority Order

The application will check for images in this order:
1. **Local files** (in `public/images/events/`) - **HIGHEST PRIORITY**
   - Tries event ID first, then sanitized event name
2. Firestore database cache
3. Provided bannerUrl/posterUrl (if not from cagematch.net)
4. Online search (Wikimedia Commons, Wikipedia API, etc.)
5. Fallback to placeholder image

## Tips

- **JPG format is recommended** for event posters as they're usually photos
- **PNG format** works well if you need transparency
- Make sure your poster files are optimized for web use (reasonable file size, typically 800-1200px wide)
- The application will automatically detect and use your local files once you place them here
- No code changes needed - just add the files and restart the dev server

## Example

If you want to add a custom poster for "Survivor Series 2025":
1. Save your poster as `wwe-survivor-2025.jpg` or `survivor-series-2025.jpg`
2. Place it in `public/images/events/wwe-survivor-2025.jpg`
3. Restart your development server
4. The app will automatically use your local poster instead of searching online

## Finding Event IDs

Event IDs are typically in the format: `{promotion}-{event-name}-{year}`
- Examples: `wwe-survivor-2025`, `aew-worlds-end-2025`, `njpw-wk20`

You can also check the browser console or Firestore to see the exact event IDs used in your database.

