import { useEffect, useState } from 'react';
import { authApi, type LegalDocuments } from './api';

export function useLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocuments | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    authApi
      .currentDocuments()
      .then((value) => {
        if (active) setDocuments(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return {
    documents,
    failed,
    reload() {
      setDocuments(null);
      setFailed(false);
      setRevision((value) => value + 1);
    },
  };
}

export function versionsOf(documents: LegalDocuments) {
  return {
    terms: documents.terms.version,
    privacy: documents.privacy.version,
    dataProcessing: documents.dataProcessing.version,
  };
}
