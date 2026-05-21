import { useMemo } from 'react';
import { motion } from 'motion/react';

interface StatusCircleProps {
  src?: string;
  username?: string;
  hasStatus?: boolean;
  isOwn?: boolean;
  size?: number;
  onClick?: () => void;
}

export default function StatusCircle({
  src,
  username,
  hasStatus = false,
  isOwn = false,
  size = 48,
  onClick
}: StatusCircleProps) {
  const gradientColors = useMemo(() => {
    if (isOwn) {
      return 'linear-gradient(45deg, #00bfa5, #00bfa5)';
    }
    if (hasStatus) {
      return 'linear-gradient(45deg, #2563eb, #7c3aed, #db2777, #ea580c)';
    }
    return 'transparent';
  }, [hasStatus, isOwn]);

  const borderWidth = useMemo(() => {
    if (hasStatus || isOwn) return size * 0.08;
    return 2;
  }, [hasStatus, isOwn, size]);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative cursor-pointer"
      style={{ width: size, height: size }}
    >
      {hasStatus || isOwn ? (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          <defs>
            <linearGradient id={`gradient-${username}`} gradientTransform="rotate(45)">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="33%" stopColor="#7c3aed" />
              <stop offset="66%" stopColor="#db2777" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={(size - borderWidth * 2) / 2}
            fill="none"
            stroke={isOwn ? '#00bfa5' : `url(#gradient-${username})`}
            strokeWidth={borderWidth}
            strokeLinecap="round"
            initial={{ strokeDasharray: 0, strokeDashoffset: 0 }}
            animate={{ strokeDasharray: 100 }}
            transition={{ duration: 0.5 }}
          />
        </svg>
      ) : null}

      <div
        className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: size - borderWidth * 2,
          height: size - borderWidth * 2,
          top: borderWidth,
          left: borderWidth
        }}
      >
        {src ? (
          <img
            src={src}
            alt={username || 'User'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-header-bg flex items-center justify-center">
            <span className="text-text-secondary font-semibold text-lg">
              {(username || 'U')[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {isOwn && (
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center border-2 border-sidebar-bg">
          <span className="text-white text-xs font-bold">+</span>
        </div>
      )}
    </motion.div>
  );
}