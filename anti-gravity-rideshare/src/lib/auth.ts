import { User, UserRole } from './types';
import { db } from './db';

// Simple mock session management
// In a real app, this would use cookies/JWT
let CURRENT_USER_ID: string | null = null;

export const AuthService = {
    // Simulate login
    login: async (email: string) => {
        const user = await db.users.findByEmail(email);
        if (!user) throw new Error('User not found');
        CURRENT_USER_ID = user.id;
        return user;
    },

    logout: () => {
        CURRENT_USER_ID = null;
    },

    getCurrentUser: async () => {
        if (!CURRENT_USER_ID) return null;
        return await db.users.findById(CURRENT_USER_ID);
    },

    // Role-Based Access Control Check
    hasPermission: (user: User, requiredRole: UserRole | UserRole[]) => {
        if (Array.isArray(requiredRole)) {
            return requiredRole.includes(user.role);
        }
        return user.role === requiredRole;
    },

    // Parental Control Check
    canChildRequestRide: async (childId: string) => {
        const child = await db.users.findById(childId);
        if (!child || child.role !== 'CHILD') return false;

        // Logic: If parent has restricted rides (mock logic could go here)
        // For now, return true
        return true;
    }
};
