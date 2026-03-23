import React, { useState, useEffect } from 'react';

const TreevitLoader = ({ size = 56, className = "" }) => {
  const [islightMode, setIslightMode] = useState(
    document.body.getAttribute('data-theme') === 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIslightMode(document.body.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .tw circle {
          opacity: 0;
          animation: typeOn 2.5s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .tw circle:nth-child(1) { animation-delay: 0.00s; }
        .tw circle:nth-child(2) { animation-delay: 0.18s; }
        .tw circle:nth-child(3) { animation-delay: 0.36s; }
        .tw circle:nth-child(4) { animation-delay: 0.54s; }
        .tw circle:nth-child(5) { animation-delay: 0.72s; }
        .tw circle:nth-child(6) { animation-delay: 0.90s; }
        .tw circle:nth-child(7) { animation-delay: 1.08s; }
        .tw circle:nth-child(8) { animation-delay: 1.26s; }
        .tw circle:nth-child(9) { animation-delay: 1.44s; }
        @keyframes typeOn {
          0%       { opacity: 0; transform: scale(0.3); }
          15%, 70% { opacity: 1; transform: scale(1);   }
          90%,100% { opacity: 0; transform: scale(0.3); }
        }
        .trunk {
          opacity: 1 !important;
          animation: none !important;
        }
        .cursor-logo {
          display: inline-flex;
          vertical-align: middle;
          margin-left: 4px;
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {islightMode ? (
        <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
          <rect className="trunk" x="96" y="130" width="8" height="28" rx="4" fill="#16a085" opacity="1"/>
          <g className="tw">
            <circle cx="100" cy="54"  r="14" fill="#16a085"/>
            <circle cx="82"  cy="80"  r="11" fill="#1abc9c"/>
            <circle cx="118" cy="80"  r="11" fill="#1abc9c"/>
            <circle cx="68"  cy="106" r="9"  fill="#2ecc71"/>
            <circle cx="100" cy="100" r="13" fill="#16a085"/>
            <circle cx="132" cy="106" r="9"  fill="#2ecc71"/>
            <circle cx="56"  cy="128" r="8"  fill="#27ae60"/>
            <circle cx="85"  cy="122" r="10" fill="#27ae60"/>
            <circle cx="115" cy="122" r="10" fill="#27ae60"/>
          </g>
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
          <rect className="trunk" x="96" y="130" width="8" height="28" rx="4" fill="#fff" opacity="1"/>
          <g className="tw">
            <circle cx="100" cy="54"  r="14" fill="#fff"/>
            <circle cx="82"  cy="80"  r="11" fill="#fff"/>
            <circle cx="118" cy="80"  r="11" fill="#fff"/>
            <circle cx="68"  cy="106" r="9"  fill="#fff"/>
            <circle cx="100" cy="100" r="13" fill="#fff"/>
            <circle cx="132" cy="106" r="9"  fill="#fff"/>
            <circle cx="56"  cy="128" r="8"  fill="#fff"/>
            <circle cx="85"  cy="122" r="10" fill="#fff"/>
            <circle cx="115" cy="122" r="10" fill="#fff"/>
          </g>
        </svg>
      )}
    </>
  );
};

export default TreevitLoader;
