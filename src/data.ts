import { AuctionItem, Opponent } from './types';

export const AUCTION_ITEMS: AuctionItem[] = [
  {
    id: '1',
    name: '1 Kg de Asado de Tira Premium',
    description: 'El corte clásico argentino de costilla de carne vacuna, ideal para el asado del domingo con la familia. ¡Bien tierna y sabrosa!',
    realPrice: 9800,
    startingBid: 3500,
    imagePath: '/src/assets/images/asado_de_tira_1780696309778.png',
    category: 'Comida'
  },
  {
    id: '2',
    name: 'Termo Clásico de Acero Inoxidable (1 Litro)',
    description: 'Termo de doble pared que mantiene el agua caliente hasta por 24 horas. Indispensable para los mates a toda hora.',
    realPrice: 85000,
    startingBid: 28000,
    imagePath: '/src/assets/images/termo_y_mate_1780696321831.png',
    category: 'Matiada'
  },
  {
    id: '3',
    name: 'Paquete de Yerba Mate Especial (1 Kg)',
    description: 'Yerba mate con palo de primera calidad, sabor suave, equilibrado y de molienda estacionaria para que no se lave el mate.',
    realPrice: 4200,
    startingBid: 1500,
    imagePath: '/src/assets/images/yerba_mate_1780696335010.png',
    category: 'Matiada'
  },
  {
    id: '4',
    name: 'Una Docena de Facturas Surtidas Calentitas',
    description: 'Las mejores medialunas de grasa, croissants de manteca y facturas rellenas con abundante dulce de leche y crema pastelera.',
    realPrice: 6500,
    startingBid: 2000,
    imagePath: '/src/assets/images/facturas_dulces_1780696345775.png',
    category: 'Comida'
  },
  {
    id: '5',
    name: 'Pava Eléctrica con Regulador de Temperatura',
    description: 'Pava con selector exacto a 80°C especial para infusión de mate, corte automático y terminación de acero.',
    realPrice: 39500,
    startingBid: 14000,
    imagePath: '/src/assets/images/pava_electrica_1780696359286.png',
    category: 'Electrodoméstico'
  }
];

export const OPPONENTS: Opponent[] = [
  {
    id: 'opponent1',
    name: 'Doña Rosa',
    avatar: '👵',
    personality: 'cautelosa',
    budget: 90000,
    role: 'Vecina del barrio'
  },
  {
    id: 'opponent2',
    name: 'Don Tito',
    avatar: '👴',
    personality: 'temperamental',
    budget: 120000,
    role: 'Jubilado apasionado'
  },
  {
    id: 'opponent3',
    name: 'Clarito',
    avatar: '👩‍🦰',
    personality: 'atrevida',
    budget: 85000,
    role: 'Estudiante buscadora de ofertas'
  }
];
