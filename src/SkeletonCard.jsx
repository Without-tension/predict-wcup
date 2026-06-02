import React from 'react';

const SkeletonCard = () => {
  return (
    <div className="max-w-[600px] margin-[12px_auto] padding-[12px_16px] bg-[#1a1f2c] rounded-[12px] border border-[#2d3748] animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 bg-gray-800 rounded w-1/4"></div>
        <div className="h-4 bg-gray-800 rounded w-1/3"></div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-[35%]">
          <div className="w-[26px] h-[18px] bg-gray-800 rounded"></div>
          <div className="h-5 bg-gray-800 rounded w-3/4"></div>
        </div>
        <div className="flex gap-2 w-[30%] justify-center">
          <div className="h-10 bg-gray-800 rounded flex-1"></div>
          <div className="h-10 bg-gray-800 rounded flex-1"></div>
          <div className="h-10 bg-gray-800 rounded flex-1"></div>
        </div>
        <div className="flex items-center justify-end gap-2 w-[35%]">
          <div className="h-5 bg-gray-800 rounded w-3/4"></div>
          <div className="w-[26px] h-[18px] bg-gray-800 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;