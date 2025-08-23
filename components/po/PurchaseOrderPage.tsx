
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useParams } = ReactRouterDOM;
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
