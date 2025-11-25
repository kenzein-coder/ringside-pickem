import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  getProxiedImageUrl,
  PROMOTION_LOGOS,
  PROMOTIONS,
  checkLocalImage,
  searchPromotionLogo,
  saveImageToFirestore,
  getImageFromFirestore,
} from '../App.jsx';

const BrandLogo = React.memo(({ id, className = 'w-full h-full object-contain' }) => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [imageSource, setImageSource] = useState('loading');
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    const loadLogo = async () => {
      // Step 1: Check local file
      const localPath = `/images/promotions/${id}.png`;
      const localExists = await checkLocalImage(localPath);
      if (localExists) {
        setCurrentLogoUrl(localPath);
        setImageSource('local');
        return;
      }

      // Step 2: Check Firestore
      try {
        const firestoreUrl = await getImageFromFirestore('promotions', id);
        if (firestoreUrl) {
          setCurrentLogoUrl(firestoreUrl);
          setLogoUrl(firestoreUrl);
          setImageSource('database');
          return;
        }
      } catch (error) {
        // Continue to next step
      }

      // Step 3: Check hardcoded PROMOTION_LOGOS
      if (PROMOTION_LOGOS[id]) {
        const url = PROMOTION_LOGOS[id];
        setCurrentLogoUrl(url);
        setLogoUrl(url);
        setImageSource('initial');
        // Save to Firestore for future use
        saveImageToFirestore('promotions', id, url);
        return;
      }

      // Step 4: Search multiple sources
      try {
        const promo = PROMOTIONS.find(p => p.id === id);
        const promotionName = promo?.name || id;
        const foundUrl = await searchPromotionLogo(id, promotionName);
        if (foundUrl) {
          setCurrentLogoUrl(foundUrl);
          setImageSource('database');
          return;
        }
      } catch (error) {
        // Logo search failed
      }

      // Step 5: No logo found
      setCurrentLogoUrl(null);
      setImageSource('fallback');
    };

    loadLogo();
  }, [id, logoUrl]);

  const handleImageError = () => {
    if (imageSource === 'initial' && currentLogoUrl) {
      const proxied = getProxiedImageUrl(currentLogoUrl, 200, 200, 'wsrv');
      setCurrentLogoUrl(proxied);
      setImageSource('proxy');
    } else if (imageSource === 'proxy' && currentLogoUrl) {
      const originalUrl =
        logoUrl && !logoUrl.includes('cagematch.net') ? logoUrl : PROMOTION_LOGOS[id] || logoUrl;
      if (originalUrl) {
        const proxied = getProxiedImageUrl(originalUrl, 200, 200, 'images');
        setCurrentLogoUrl(proxied);
      } else {
        setImageSource('fallback');
      }
    } else if (imageSource === 'wikimedia' && currentLogoUrl) {
      const proxied = getProxiedImageUrl(currentLogoUrl, 200, 200, 'wsrv');
      setCurrentLogoUrl(proxied);
      setImageSource('proxy');
    } else {
      setImageSource('fallback');
    }
  };

  if (imageSource === 'fallback' || !currentLogoUrl) {
    return (
      <div className={`${className} bg-slate-800 rounded flex items-center justify-center`}>
        <span className="text-xs text-slate-500 font-bold uppercase">{id}</span>
      </div>
    );
  }

  return (
    <img
      src={currentLogoUrl}
      alt={`${id} logo`}
      className={className}
      onError={handleImageError}
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
});

BrandLogo.displayName = 'BrandLogo';

BrandLogo.propTypes = {
  id: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default BrandLogo;
