import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db/database';

const Ctx = createContext<SQLiteDatabase | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const database = await getDatabase();
      if (!cancelled) setDb(database);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Ctx.Provider value={db}>{children}</Ctx.Provider>;
}

export function useDatabase(): SQLiteDatabase {
  const db = useContext(Ctx);
  if (!db) throw new Error('useDatabase outside DatabaseProvider');
  return db;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
