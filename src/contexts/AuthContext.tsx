// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Role = 'superadmin' | 'admin' | null;

export interface AdminRecord {
  role: Role;
  sections: string[] | 'all'; // 'all' = superadmin, array = delegated sections
}

interface AuthContextValue {
  user: User | null;
  role: Role;
  allowedSections: string[] | 'all';
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  allowedSections: [],
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [allowedSections, setAllowedSections] = useState<string[] | 'all'>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          if (adminDoc.exists()) {
            const data = adminDoc.data() as AdminRecord;
            setRole(data.role);
            setAllowedSections(data.sections);
          } else {
            // Authenticated but not in admins collection
            setRole(null);
            setAllowedSections([]);
          }
        } catch {
          setRole(null);
          setAllowedSections([]);
        }
      } else {
        setRole(null);
        setAllowedSections([]);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, allowedSections, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
