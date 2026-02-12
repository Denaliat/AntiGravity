import { ParcelDelivery, ProofOfDelivery, User, AuditEvent } from './types';

// In-memory storage acting as our "Database"
const DB = {
    users: [] as User[],
    deliveries: [] as ParcelDelivery[],
    proofs: [] as ProofOfDelivery[],
    auditLogs: [] as AuditEvent[],
    rides: [] as import('./types').Ride[]
};

// Seed some initial data
DB.users.push(
    { id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
    { id: 'driver-1', name: 'John Driver', email: 'driver@example.com', role: 'DRIVER' },
    { id: 'parent-1', name: 'Jane Parent', email: 'parent@example.com', role: 'PARENT' },
    { id: 'rider-1', name: 'Alice Rider', email: 'rider@example.com', role: 'SENDER' }, // reused SENDER as generic User for now
    { id: 'child-1', name: 'Timmy Child', email: 'child@example.com', role: 'CHILD', parentId: 'parent-1', isLocationHidden: false }
);

export const db = {
    users: {
        findById: async (id: string) => DB.users.find(u => u.id === id),
        findByEmail: async (email: string) => DB.users.find(u => u.email === email),
        create: async (user: User) => { DB.users.push(user); return user; },
        update: async (id: string, data: Partial<User>) => {
            const idx = DB.users.findIndex(u => u.id === id);
            if (idx === -1) throw new Error('User not found');
            DB.users[idx] = { ...DB.users[idx], ...data };
            return DB.users[idx];
        }
    },
    rides: {
        create: async (ride: import('./types').Ride) => { DB.rides.push(ride); return ride; },
        findAll: async (status?: string) => status ? DB.rides.filter(r => r.status === status) : [...DB.rides],
        findById: async (id: string) => DB.rides.find(r => r.rideId === id),
        updateStatus: async (id: string, status: import('./types').Ride['status'], driverId?: string) => {
            const ride = DB.rides.find(r => r.rideId === id);
            if (ride) {
                ride.status = status;
                if (driverId) ride.driverId = driverId;
                return ride;
            }
            throw new Error('Ride not found');
        }
    },
    deliveries: {
        create: async (delivery: ParcelDelivery) => { DB.deliveries.push(delivery); return delivery; },
        findById: async (id: string) => DB.deliveries.find(d => d.deliveryId === id),
        findAll: async () => [...DB.deliveries],
        updateStatus: async (id: string, status: ParcelDelivery['status']) => {
            const delivery = DB.deliveries.find(d => d.deliveryId === id);
            if (delivery) {
                delivery.status = status;
                return delivery;
            }
            throw new Error('Delivery not found');
        }
    },
    proofs: {
        create: async (proof: ProofOfDelivery) => { DB.proofs.push(proof); return proof; },
        findByDeliveryId: async (deliveryId: string) => DB.proofs.find(p => p.deliveryId === deliveryId)
    }
};
