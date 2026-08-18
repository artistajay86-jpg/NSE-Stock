import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const getDb = () => getFirestore();

export interface UserProfile {
  uid: string;
  email: string;
  total_capital: number;
  balance: number;
  brokerage_config?: {
    apiKey: string;
    apiSecret: string;
    broker: string;
  };
}

export interface Position {
  id?: string;
  userId: string;
  symbol: string;
  entryPrice: number;
  shares: number;
  status: 'OPEN' | 'CLOSED';
  entryDate: string;
  exitDate?: string;
  exitPrice?: number;
  initialStopLossPct: number;
  initialTargetPct: number;
  highestPriceReached?: number;
  notes?: string;
  isLive?: boolean;
}

export const userService = {
  async getOrCreateUser(uid: string, email: string): Promise<UserProfile> {
    const userRef = getDb().collection('users').doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      const newUser: UserProfile = {
        uid,
        email,
        total_capital: 1000000,
        balance: 1000000,
      };
      await userRef.set(newUser);
      return newUser;
    }
    return doc.data() as UserProfile;
  },

  async updateUserCapital(uid: string, totalCapital: number): Promise<UserProfile> {
    const userRef = getDb().collection('users').doc(uid);
    const user = await this.getOrCreateUser(uid, '');
    const diff = totalCapital - user.total_capital;
    const newBalance = user.balance + diff;
    await userRef.update({ total_capital: totalCapital, balance: newBalance });
    return { ...user, total_capital: totalCapital, balance: newBalance };
  },

  async updateBalance(uid: string, amountChange: number): Promise<void> {
    const userRef = getDb().collection('users').doc(uid);
    await userRef.update({
      balance: FieldValue.increment(amountChange)
    });
  },

  async addPosition(position: Position): Promise<string> {
    const res = await getDb().collection('active_positions').add(position);
    return res.id;
  },

  async getPositions(uid: string): Promise<Position[]> {
    const snapshot = await getDb().collection('active_positions')
      .where('userId', '==', uid)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position));
  },

  async updatePosition(id: string, updates: Partial<Position>): Promise<void> {
    await getDb().collection('active_positions').doc(id).update(updates);
  },

  async getPosition(id: string): Promise<Position | null> {
    const doc = await getDb().collection('active_positions').doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Position) : null;
  },

  async getAllOpenPositions(): Promise<Position[]> {
    const snapshot = await getDb().collection('active_positions')
      .where('status', '==', 'OPEN')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position));
  },

  async saveBrokerageConfig(uid: string, config: UserProfile['brokerage_config']): Promise<void> {
    await getDb().collection('users').doc(uid).update({ brokerage_config: config });
  }
};
