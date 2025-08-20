

import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  onClick?: () => void; // Added onClick prop
  titleActions?: ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', titleClassName = '', bodyClassName = '', footer, onClick, titleActions }) => {
  return (
    <div className={`bg-white shadow-lg rounded-xl overflow-hidden ${className}`} onClick={onClick}> {/* Applied onClick prop */}
      {title && (
        <div className={`flex items-center justify-between px-4 py-3 sm:px-6 border-b border-gray-200 ${titleClassName}`}>
          <h3 className="text-lg leading-6 font-semibold text-gray-900">{title}</h3>
          {titleActions && <div>{titleActions}</div>}
        </div>
      )}
      <div className={`p-4 sm:p-6 ${bodyClassName}`}>
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 sm:px-6 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;