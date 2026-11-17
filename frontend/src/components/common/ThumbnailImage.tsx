import React, { useState } from 'react';

interface ThumbnailImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({ src, alt, className = '' }) => {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const isLoaded = loadedSource === src;
  const hasFailed = failedSource === src;

  return (
    <>
      {!isLoaded && !hasFailed && <span className="skeleton absolute inset-0" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoadedSource(src)}
        onError={() => setFailedSource(src)}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {hasFailed && (
        <span role="status" className="absolute inset-0 flex items-center justify-center bg-slate-100 p-2 text-center text-xs text-slate-600">
          Không thể tải ảnh
        </span>
      )}
    </>
  );
};
