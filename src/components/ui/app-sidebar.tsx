"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Package,
    Users,
    ShoppingCart,
    DollarSign,
    FileText,
    Box,
    Briefcase,
    LogOut
} from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import Image from "next/image";

// Define all navigation items with role permissions
const allNavigationItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["superuser", "admin", "management"] },
    { name: "Business Line", href: "/businessline-management", icon: Briefcase, roles: ["superuser", "admin", "management"] },
    { name: "Items", href: "/items-management", icon: Package, roles: ["superuser", "admin", "management"] },
    { name: "Stock Adjustment", href: "/stock-adjustment", icon: Box, roles: ["superuser", "admin", "management"] },
    { name: "Vendor Management", href: "/vendor-management", icon: Users, roles: ["superuser", "admin", "management"] },
    { name: "Customer Management", href: "/customer-management", icon: Users, roles: ["superuser", "admin", "management"] },
    { name: "Sales", href: "/sales-management", icon: ShoppingCart, roles: ["superuser", "admin", "management", "sales"] },
    { name: "Purchase", href: "/purchase-management", icon: DollarSign, roles: ["superuser", "admin", "management"] },
    { name: "Reports", href: "/reports", icon: FileText, roles: ["superuser", "admin", "management"] },
    { name: "Users", href: "/users", icon: Users, roles: ["superuser", "admin"] },
    { name: "Credit Management", href: "/credit-management", icon: DollarSign, roles: ["superuser", "admin", "management"] },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { logout, user } = useAuth();

    const handleLogout = async () => {
        await logout();
        window.location.href = '/';
    };

    // Get the current business line name
    const [currentBusinessLineName, setCurrentBusinessLineName] = useState("");
    
    useEffect(() => {
        const fetchBusinessLineName = async () => {
            if (!user || !user.currentBusinessLine) return;
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/business-lines`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const businessLines = await response.json();
                    const currentBL = businessLines.find((bl: { id: string }) => Number(bl.id) === user.currentBusinessLine);
                    if (currentBL) {
                        setCurrentBusinessLineName(currentBL.name);
                    }
                }
            } catch (error) {
                console.error("Error fetching business line details:", error);
            }
        };
        
        fetchBusinessLineName();
    }, [user]);
    
    // Filter navigation items based on user role
    const getNavigationItems = () => {
        if (!user) return [];
        
        // Default to 'sales' for the example, but use actual userType from auth context
        const userRole = user.userType || 'sales';
        
        // For superuser, show all navigation items
        if (userRole === 'superuser') {
            return allNavigationItems;
        }
        
        // For other roles, filter based on the roles array
        return allNavigationItems.filter(item => 
            item.roles.includes(userRole)
        );
    };

    const navigationItems = getNavigationItems();

    return (
        <Sidebar className="border-r bg-[hsl(var(--sidebar-background))] border-[hsl(var(--sidebar-border))]">
            <SidebarContent>
                <div className="flex flex-col h-full">
                    <div className="flex justify-center py-4">
                    <Image
                        src="/logo.png"
                        alt="Company Logo"
                        width={120}
                        height={40}
                        className="h-12 w-auto"
                        priority
                        quality={100}
                        unoptimized
                    />
                    </div>

                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navigationItems.map((item) => (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={pathname === item.href}
                                            className={`group transition-colors duration-200
                                                ${pathname === item.href 
                                                    ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' 
                                                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                                                }`}
                                        >
                                            <Link 
                                                href={item.href} 
                                                className="flex items-center gap-3 px-4 py-2 rounded-lg"
                                            >
                                                <item.icon className="w-5 h-5" />
                                                <span className="text-sm font-medium">{item.name}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    {/* User Info Section */}
                    {user && (
                        <div className="mt-auto px-4 py-3 border-t border-[hsl(var(--sidebar-border))]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-black font-semibold border">
                                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate capitalize">{user.userType}</p>
                                </div>
                            </div>
                            
                            {/* Business Line Indicator */}
                            <div className="mt-2 rounded-md bg-gray-50 dark:bg-blue-900/20 px-3 py-1.5">
                                <div className="flex items-center">
                                    <Briefcase className="w-3.5 h-3.5 text-gray-500 mr-1.5" />
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {currentBusinessLineName || "Loading business line..."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logout Section */}
                    <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
                        <Dialog>
                            <DialogTrigger asChild>
                                <SidebarMenuButton 
                                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors duration-200"
                                >
                                    <div className="flex items-center gap-3 px-4 py-2">
                                        <LogOut className="w-5 h-5" />
                                        <span className="text-sm font-medium">Logout</span>
                                    </div>
                                </SidebarMenuButton>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Confirm Logout</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to logout? You will be redirected to the login page.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-4 gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => document.querySelector('[role="dialog"]')?.closest('dialog')?.close()}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        variant="destructive"
                                        onClick={handleLogout}
                                    >
                                        Logout
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </SidebarContent>
        </Sidebar>
    );
}