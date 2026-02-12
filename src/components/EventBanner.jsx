import React, { useState, useEffect } from 'react';

/**
 * Renders an event poster/banner with loading and fallback.
 * @param {Object} event - Event object (id, name, bannerUrl, posterUrl)
 * @param {string} className - CSS class for the img
 * @param {string} fallbackClassName - Unused, kept for API compatibility
 * @param {function} getEventImage - (event) => Promise<string> - resolves to image URL
 */
export default function EventBanner({
  event,
  className = 'w-full h-full object-cover',
  fallbackClassName,
  getEventImage,
}) {
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!event || !getEventImage) return;

    setIsLoading(true);
    setHasError(false);

    const loadEventImage = async () => {
      try {
        const imageUrl = await getEventImage(event);
        setCurrentImageUrl(imageUrl);
      } catch (error) {
        console.log(`Failed to load event image for ${event.name}:`, error);
        setHasError(true);
        setCurrentImageUrl(`https://picsum.photos/seed/${event.id}/800/400`);
      } finally {
        setIsLoading(false);
      }
    };

    loadEventImage();
  }, [event?.id, event?.name, event?.bannerUrl, event?.posterUrl, getEventImage]);

  const handleImageError = () => {
    setHasError(true);
    setCurrentImageUrl(`https://picsum.photos/seed/${event?.id}/800/400`);
  };

  if (!event) return null;

  return (
    <img
      src={currentImageUrl || `https://picsum.photos/seed/${event.id}/800/400`}
      alt={`${event.name} poster`}
      className={className}
      onError={handleImageError}
      onLoad={() => setIsLoading(false)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
    />
  );
}
