import React from 'react';
import { useParams } from 'react-router-dom';
import PurchaseOrderForm from './PurchaseOrderForm';

const PurchaseOrderPage: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();

  return (
    <div>
      <PurchaseOrderForm poIdToEdit={poId} />
    </div>
  );
};

export default PurchaseOrderPage;