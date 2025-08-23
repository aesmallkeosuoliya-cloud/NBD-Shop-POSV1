
import React, { useState, useEffect, useCallback } from 'react';
import { Purchase, PurchaseOrder } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../../components/common/Button'; 
import Card from '../../components/common/Card'; 
import PurchaseForm from './PurchaseForm';
import LoadingSpinner from '../../components/common/LoadingSpinner'; 
import { addPurchaseAndProcess, getPurchaseOrderById } from '../../services/firebaseService';
import { UI_COLORS } from '../../constants';
import * as ReactRouterDOM from 'react-router-dom';
const { useLocation, useNavigate } = ReactRouterDOM;
import SelectPOModal from '../../components/po/SelectPOModal'; 

declare var Swal: any; // For SweetAlert2

const ImportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
</svg>;

const PurchasesPage: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation(); 
  const navigate = useNavigate(); 

  const [formLoading, setFormLoading] = useState(false);
  const [initialPO, setInitialPO] = useState<PurchaseOrder | null>(null);
  const [isLoadingPO, setIsLoadingPO] = useState(false);
  const [isSelectPOModalOpen, setIsSelectPOModalOpen] = useState(false);

  useEffect(() => {
    const fetchPOData = async () => {
      const queryParams = new URLSearchParams(location.search);
      const poIdFromUrl = queryParams.get('poId');
      
      if (poIdFromUrl) {
        setIsLoadingPO(true);
        try {
          const po = await getPurchaseOrderById(poIdFromUrl);
          if (po) {
            setInitialPO(po);
          } else {
            Swal.fire(t('error'), t('errorFetchingPOs') + ` ID: ${poIdFromUrl}`, 'error');
            navigate('/purchases', { replace: true }); 
          }
        } catch (error) {
          console.error("Error fetching PO for import:", error);
          Swal.fire(t('error'), t('errorFetchingPOs'), 'error');
          navigate('/purchases', { replace: true }); 
        } finally {
          setIsLoadingPO(false);
        }
      } else {
        setInitialPO(null); // Clear if no poId
      }
    };

    fetchPOData();
  }, [location.search, t, navigate]);
  
  const handleSubmitForm = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    setFormLoading(true);
    try {
      const expenseCategoryText = t('purchaseExpenseCategory');
      const expenseDescriptionTemplate = t('purchaseExpenseDescription');
      const costAccountingCategoryName = t('accountingCategory_cost');
      await addPurchaseAndProcess(purchaseData, expenseCategoryText, expenseDescriptionTemplate, costAccountingCategoryName);
      Swal.fire(t('success'), t('purchaseSuccess'), 'success');
      navigate('/purchase-history', { replace: true }); 
    } catch (error) {
      console.error("Error saving purchase (stock-in):", error);
      Swal.fire(t('error'), t('errorProcessingPurchase'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelForm = () => {
    navigate('/purchase-history');
  };
  
  const handleOpenSelectPOModal = () => {
    setIsSelectPOModalOpen(true);
  };

  const handlePOSelectedFromModal = (poId: string) => {
    setIsSelectPOModalOpen(false);
    navigate(`/purchases?poId=${poId}`); // This will trigger the useEffect to fetch and pre-fill
  };

  const getPageTitle = () => {
    if (isLoadingPO) return t('loading');
    if (initialPO) return `${t('importFromPO')}: ${initialPO.poNumber}`;
    return t('addNewPurchase');
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-semibold text-gray-700">{getPageTitle()}</h1>
        <div className="flex items-center gap-3">
            <Button onClick={handleOpenSelectPOModal} variant="secondary" leftIcon={<ImportIcon />}>
                {t('importFromPO')}
            </Button>
        </div>
      </div>

      {isLoadingPO ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <Card>
            <PurchaseForm
              onSubmit={handleSubmitForm} 
              onCancel={handleCancelForm}
              isLoading={formLoading}
              initialPOData={initialPO} 
            />
        </Card>
      )}

      {isSelectPOModalOpen && (
          <SelectPOModal
            isOpen={isSelectPOModalOpen}
            onClose={() => setIsSelectPOModalOpen(false)}
            onPOSelect={handlePOSelectedFromModal}
          />
      )}
    </div>
  );
};

export default PurchasesPage;
