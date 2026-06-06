export interface AuctionItem {
  id: string;
  name: string;
  description: string;
  realPrice: number; // Real market price today in Argentina
  startingBid: number; // Starting price in ARS
  imagePath: string;
  category: string;
  emoji?: string;
}

export type Personality = 'cautelosa' | 'atrevida' | 'temperamental';

export interface Opponent {
  id: string;
  name: string;
  avatar: string;
  personality: Personality;
  budget: number;
  role: string; // e.g. "Doña de casa", "Jubilado entusiasta", "Comerciante del barrio"
}

export interface Bid {
  bidderName: string;
  bidderId: string; // 'user' or opponent id
  amount: number;
  timestamp: Date;
}

export interface GameStats {
  spent: number;
  saved: number; // Sum of (Real Price - Paid Price) for won items
  wonItemsCount: number;
}
