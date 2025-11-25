# Adding Custom Promotion Logos

You can add your own promotion logo images to this folder, and they will be automatically used by the application.

## How to Add Logos

1. **Place your logo files** in this directory: `public/images/promotions/`

2. **Name your files** using the promotion ID (lowercase) with the appropriate extension:
   - `wwe.svg` or `wwe.png` (for WWE)
   - `aew.png` (for AEW)
   - `njpw.svg` (for NJPW)
   - `tna.png` (for TNA/Impact)
   - `roh.png` (for ROH)
   - `stardom.png` (for Stardom)
   - `cmll.svg` (for CMLL)
   - `aaa.png` (for AAA)
   - `gcw.png` (for GCW)
   - `mlw.svg` (for MLW)

3. **Supported file formats:**
   - `.svg` (Scalable Vector Graphics - recommended for logos)
   - `.png` (Portable Network Graphics)
   - `.jpg` or `.jpeg` (JPEG)
   - `.webp` (WebP)

4. **File naming examples:**
   ```
   public/images/promotions/wwe.svg
   public/images/promotions/aew.png
   public/images/promotions/cmll.svg
   ```

## Priority Order

The application will check for images in this order:
1. **Local files** (in `public/images/promotions/`) - **HIGHEST PRIORITY**
2. Firestore database cache
3. Hardcoded URLs in the code
4. Online search (Wikimedia Commons, Wikipedia API, etc.)
5. Fallback to colored gradient with text

## Tips

- **SVG format is recommended** for logos as they scale perfectly at any size
- **PNG format** works well for logos with transparency
- Make sure your logo files are optimized for web use (reasonable file size)
- The application will automatically detect and use your local files once you place them here
- No code changes needed - just add the files and restart the dev server

## Example

If you want to add a custom WWE logo:
1. Save your logo as `wwe.svg` or `wwe.png`
2. Place it in `public/images/promotions/wwe.svg`
3. Restart your development server
4. The app will automatically use your local logo instead of searching online

