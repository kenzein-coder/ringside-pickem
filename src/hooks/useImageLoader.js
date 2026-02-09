import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for loading images with multiple fallback strategies
 * Handles local files, Firestore cache, external URLs, proxies, and fallbacks
 * 
 * @param {string} id - Unique identifier for the image
 * @param {string} type - Type of image ('promotions' or 'wrestlers')
 * @param {object} options - Configuration options
 * @returns {object} Image loading state and handlers
 */
export const useImageLoader = (
  id,
  type = 'promotions',
  options = {}
) => {
  const {
    logoUrl,
    imageUrl,
    checkLocalImage,
    getImageFromFirestore,
    saveImageToFirestore,
    getImageFromStorage,
    searchImage,
    getProxiedImageUrl,
    downloadAndUploadImage,
    hardcodedImages = {},
    normalizeNameFn,
  } = options;

  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageSource, setImageSource] = useState('initial');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    setIsLoading(true);
    setImageSource('initial');
    setHasError(false);
    retryCountRef.current = 0;

    const loadImage = async () => {
      try {
        // Step 1: Check hardcoded images
        if (hardcodedImages[id]) {
          const url = hardcodedImages[id];
          if (url && !url.includes('cagematch.net')) {
            setCurrentImageUrl(url);
            setImageSource('initial');
            saveImageToFirestore?.(type, id, url);
            setIsLoading(false);
            return;
          }
        }

        // Step 2: Check provided URL
        const providedUrl = logoUrl || imageUrl;
        if (providedUrl && !providedUrl.includes('cagematch.net')) {
          setCurrentImageUrl(providedUrl);
          setImageSource('initial');
          saveImageToFirestore?.(type, id, providedUrl);
          setIsLoading(false);
          return;
        }

        // Step 3: Check local files
        if (checkLocalImage) {
          const extensions = ['png', 'svg', 'jpg', 'jpeg', 'webp'];
          for (const ext of extensions) {
            const localPath = `/images/${type}/${id.toLowerCase()}.${ext}`;
            const localImage = await checkLocalImage(localPath);
            if (localImage) {
              setCurrentImageUrl(localImage);
              setImageSource('local');
              saveImageToFirestore?.(type, id, localImage);
              setIsLoading(false);
              return;
            }
          }
        }

        // Step 4: Check Firestore cache
        if (getImageFromFirestore) {
          const cachedUrl = await getImageFromFirestore(type, id);
          if (cachedUrl && !cachedUrl.includes('cagematch.net')) {
            setCurrentImageUrl(cachedUrl);
            setImageSource('database');
            setIsLoading(false);
            return;
          }
        }

        // Step 5: Check Storage
        if (getImageFromStorage) {
          const storageUrl = await getImageFromStorage(type, id);
          if (storageUrl) {
            setCurrentImageUrl(storageUrl);
            setImageSource('database');
            setIsLoading(false);
            return;
          }
        }

        // Step 6: Search for image
        if (searchImage) {
          const foundUrl = await searchImage(id);
          if (foundUrl && !foundUrl.includes('cagematch.net')) {
            const proxied = getProxiedImageUrl?.(foundUrl, 400, 500, 'wsrv') || foundUrl;
            setCurrentImageUrl(proxied);
            setImageSource('database');
            setIsLoading(false);
            
            // Download and cache in background
            downloadAndUploadImage?.(foundUrl, type, id)
              .then((storageUrl) => {
                if (storageUrl) {
                  setCurrentImageUrl(storageUrl);
                }
              })
              .catch(() => {
                // Silently fail background upload
              });
            return;
          }
        }

        // Step 7: Fallback
        setCurrentImageUrl(null);
        setImageSource('fallback');
        setIsLoading(false);
      } catch (error) {
        console.error(`Image loading failed for ${id}:`, error);
        setHasError(true);
        setCurrentImageUrl(null);
        setImageSource('fallback');
        setIsLoading(false);
      }
    };

    loadImage();
  }, [id, logoUrl, imageUrl, type]);

  const handleImageError = () => {
    if (retryCountRef.current < maxRetries && currentImageUrl) {
      retryCountRef.current += 1;
      
      if (imageSource === 'initial' && getProxiedImageUrl) {
        // Try with proxy
        const proxied = getProxiedImageUrl(currentImageUrl, 400, 500, 'wsrv');
        setCurrentImageUrl(proxied);
        setImageSource('proxy');
      } else if (imageSource === 'proxy' && getProxiedImageUrl) {
        // Try alternative proxy
        const originalUrl = logoUrl || imageUrl || hardcodedImages[id];
        if (originalUrl) {
          const proxied = getProxiedImageUrl(originalUrl, 400, 500, 'images');
          setCurrentImageUrl(proxied);
        } else {
          setImageSource('fallback');
          setHasError(true);
        }
      } else {
        setImageSource('fallback');
        setHasError(true);
      }
    } else {
      setImageSource('fallback');
      setHasError(true);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  return {
    currentImageUrl,
    imageSource,
    isLoading,
    hasError,
    handleImageError,
    handleImageLoad,
  };
};

export default useImageLoader;
