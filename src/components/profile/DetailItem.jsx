import React from 'react';

const DetailItem = ({ label, value, isList = false }) => {
  const displayValue = value === true ? 'Sí' : value === false ? 'No' : value || 'No especificado';
  
  if (isList && Array.isArray(value) && value.length > 0) {
    return (
      <div className="py-2">
        <p className="text-sm text-gray-400">{label}</p>
        <ul className="list-disc list-inside font-semibold text-white">
          {value.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
    );
  }
  
  if (isList && (!Array.isArray(value) || value.length === 0)) {
     return (
      <div className="py-2">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="font-semibold text-white">No especificado</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="font-semibold text-white break-words">{displayValue}</p>
    </div>
  );
};

export default DetailItem;