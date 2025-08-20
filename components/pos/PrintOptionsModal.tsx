
import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useLanguage } from '../../contexts/LanguageContext';

interface PrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrintToPrinter: () => void;
  onSaveAsPdf: () => void;
  // isLoading?: boolean; // If needed for async operations within the modal itself
}

// Icons for buttons
const PrinterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const PDFFileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

const PrintOptionsModal: React.FC<PrintOptionsModalProps> = ({
  isOpen,
  onClose,
  onPrintToPrinter,
  onSaveAsPdf,
}) => {
  const { t } = useLanguage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('choosePrintMethodModalTitle')}
      size="md" 
    >
      <div className="space-y-4 py-4">
        <Button
          onClick={onPrintToPrinter}
          variant="success" // Green button
          className="w-full text-base py-3 justify-center"
          leftIcon={<PrinterIcon />}
        >
          {t('printToPrinter')}
        </Button>
        <Button
          onClick={onSaveAsPdf}
          variant="secondary" // Blue button
          className="w-full text-base py-3 justify-center"
          leftIcon={<PDFFileIcon />}
        >
          {t('saveAsPDF')}
        </Button>
      </div>
    </Modal>
  );
};

export default PrintOptionsModal;