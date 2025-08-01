// import React, { useState, useEffect } from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Input } from "@/components/ui/input";
// import axios from '@/lib/api/axios';
// import { toast } from '@/hooks/use-toast';
// import PurchasePaymentDetails from './PurchasePayments';

// interface VendorProduct {
//   ProductID: number;
//   Name: string;
//   CurrentQTY: number;
//   MinimumQTY: number;
//   quantity?: number;
//   unitPrice?: number;
//   total?: number;
// }

// interface VendorProductsTableProps {
//   vendorId: string | null;
//   invoiceNumber?: string;
//   invoiceDate?: Date;
//   onProductsSelect?: (products: VendorProduct[]) => void;
// }

// const VendorProductsTable: React.FC<VendorProductsTableProps> = ({ 
//   vendorId,
//   invoiceNumber = '',
//   invoiceDate = new Date(),
//   onProductsSelect 
// }) => {
//   const [products, setProducts] = useState<VendorProduct[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedProducts, setSelectedProducts] = useState<VendorProduct[]>([]);

//   useEffect(() => {
//     const fetchProducts = async () => {
//       if (!vendorId)       
//         return;
      
//       setLoading(true);
//       try {
//         const token = localStorage.getItem('token');
//         if (!token) {
//           throw new Error('No authentication token found');
//         }

//         const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/vendors/${vendorId}/products`,
//           {
//             headers: {
//               'Authorization': `Bearer ${token}`
//             }
//           }
//         );

//         const productsWithPricing = response.data.map((product: VendorProduct) => ({
//           ...product,
//           quantity: 0,
//           unitPrice: 0,
//           total: 0
//         }));

//         setProducts(productsWithPricing);
//       } catch (error: unknown) {
//         if (error instanceof Error) {
//           console.error('Error fetching products:', error);
//           toast({
//             title: "Error",
//             description: error.message || "Failed to fetch products",
//             variant: "destructive",
//           });
//         } else {
//           console.error('Unknown error:', error);
//           toast({
//             title: "Error",
//             description: "Failed to fetch products",
//             variant: "destructive",
//           });
//         }
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchProducts();
//   }, [vendorId]);

//   const handleQuantityChange = (productId: number, value: string) => {
//     const quantity = parseFloat(value) || 0;
    
//     setProducts(prevProducts => 
//       prevProducts.map(product => {
//         if (product.ProductID === productId) {
//           const total = quantity * (product.unitPrice || 0);
//           return { ...product, quantity, total };
//         }
//         return product;
//       })
//     );
//   };

//   const handleUnitPriceChange = (productId: number, value: string) => {
//     const unitPrice = parseFloat(value) || 0;
    
//     setProducts(prevProducts => 
//       prevProducts.map(product => {
//         if (product.ProductID === productId) {
//           const total = (product.quantity || 0) * unitPrice;
//           return { ...product, unitPrice, total };
//         }
//         return product;
//       })
//     );
//   };

//   // Update selected products whenever products change
//   useEffect(() => {
//     const selected = products.filter(product => 
//       (product.quantity || 0) > 0 && (product.unitPrice || 0) > 0
//     );
//     setSelectedProducts(selected);
//     onProductsSelect?.(selected);
//   }, [products, onProductsSelect]);

//   const calculateTotal = (): number => {
//     return products.reduce((acc, product) => acc + (product.total || 0), 0);
//   };

//   const resetForm = () => {
//     setProducts(prevProducts =>
//       prevProducts.map(product => ({
//         ...product,
//         quantity: 0,
//         unitPrice: 0,
//         total: 0
//       }))
//     );
//   };

//   if (loading) {
//     return <div className="text-center p-4">Loading products...</div>;
//   }

//   return (
//     <div className="flex gap-4 overflow-hidden h-[calc(100vh-14rem)]">
//       <div className="flex-[1.5]">
//         <Table className="w-full border whitespace-nowrap">
//           <TableHeader>
//             <TableRow>
//               <TableHead>Product Name</TableHead>
//               <TableHead>Quantity</TableHead>
//               <TableHead>Unit Price</TableHead>
//               <TableHead>Total</TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {products.map((product) => (
//               <TableRow key={product.ProductID}>
//                 <TableCell>{product.Name}</TableCell>
//                 <TableCell>
//                   <Input
//                     type="number"
//                     min="0"
//                     value={product.quantity || ''}
//                     onChange={(e) => handleQuantityChange(product.ProductID, e.target.value)}
//                     className="w-24"
//                   />
//                 </TableCell>
//                 <TableCell>
//                   <Input
//                     type="number"
//                     min="0"
//                     value={product.unitPrice || ''}
//                     onChange={(e) => handleUnitPriceChange(product.ProductID, e.target.value)}
//                     className="w-24"
//                   />
//                 </TableCell>
//                 <TableCell>
//                   {(product.total || 0).toFixed(2)}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//       <div className="flex-1">
//         <PurchasePaymentDetails
//           total={calculateTotal()}
//           items={selectedProducts.map(product => ({
//             ProductID: product.ProductID,
//             item: product.Name,
//             quantity: product.quantity || 0,
//             unitPrice: product.unitPrice || 0,
//             total: product.total || 0
//           }))}
//           vendorID={parseInt(vendorId || '0')}
//           invoiceNumber={invoiceNumber}
//           invoiceDate={invoiceDate}
//           onSuccess={() => {
//             resetForm();
//           }}
//           onError={(error) => {
//             toast({
//               title: "Error",
//               description: error,
//               variant: "destructive",
//             });
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default VendorProductsTable;

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from '@/lib/api/axios';
import { toast } from '@/hooks/use-toast';
import PurchasePaymentDetails from './PurchasePayments';

interface VendorProduct {
  ProductID: number;
  Name: string;
  CurrentQTY: number;
  MinimumQTY: number;
  LastPurchasePrice: number;
  LastPurchaseDate: string | null;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

interface VendorProductsTableProps {
  vendorId: string | null;
  invoiceNumber?: string;
  invoiceDate?: Date;
  onProductsSelect?: (products: VendorProduct[]) => void;
}

const VendorProductsTable: React.FC<VendorProductsTableProps> = ({ 
  vendorId,
  invoiceNumber = '',
  invoiceDate = new Date(),
  onProductsSelect 
}) => {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<VendorProduct[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!vendorId) return;
      
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/vendors/${vendorId}/products`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const productsWithPricing = response.data.map((product: VendorProduct) => ({
          ...product,
          // Ensure LastPurchasePrice is a number
          LastPurchasePrice: Number(product.LastPurchasePrice) || 0,
          quantity: 0,
          unitPrice: 0, // Will be set to LastPurchasePrice when quantity is entered
          total: 0
        }));

        setProducts(productsWithPricing);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error fetching products:', error);
          toast({
            title: "Error",
            description: error.message || "Failed to fetch products",
            variant: "destructive",
          });
        } else {
          console.error('Unknown error:', error);
          toast({
            title: "Error",
            description: "Failed to fetch products",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [vendorId]);

  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = parseFloat(value) || 0;
    
    setProducts(prevProducts => 
      prevProducts.map(product => {
        if (product.ProductID === productId) {
          // If quantity is being set for the first time and unitPrice is 0, use LastPurchasePrice
          const currentUnitPrice = product.unitPrice ?? 0;
          let unitPrice = currentUnitPrice;
          if (quantity > 0 && currentUnitPrice === 0 && product.LastPurchasePrice > 0) {
            unitPrice = product.LastPurchasePrice;
          }
          
          const total = quantity * unitPrice;
          return { ...product, quantity, unitPrice, total };
        }
        return product;
      })
    );
  };

  const handleUnitPriceChange = (productId: number, value: string) => {
    const unitPrice = parseFloat(value) || 0;
    
    setProducts(prevProducts => 
      prevProducts.map(product => {
        if (product.ProductID === productId) {
          const currentQuantity = product.quantity ?? 0;
          const total = currentQuantity * unitPrice;
          return { ...product, unitPrice, total };
        }
        return product;
      })
    );
  };

  const useLastPrice = (productId: number) => {
    setProducts(prevProducts => 
      prevProducts.map(product => {
        if (product.ProductID === productId && product.LastPurchasePrice > 0) {
          const currentQuantity = product.quantity ?? 0;
          const total = currentQuantity * product.LastPurchasePrice;
          return { ...product, unitPrice: product.LastPurchasePrice, total };
        }
        return product;
      })
    );
  };

  // Update selected products whenever products change
  useEffect(() => {
    const selected = products.filter(product => 
      (product.quantity ?? 0) > 0 && (product.unitPrice ?? 0) > 0
    );
    setSelectedProducts(selected);
    onProductsSelect?.(selected);
  }, [products, onProductsSelect]);

  const calculateTotal = (): number => {
    return products.reduce((acc, product) => acc + (product.total ?? 0), 0);
  };

  const resetForm = () => {
    setProducts(prevProducts =>
      prevProducts.map(product => ({
        ...product,
        quantity: 0,
        unitPrice: 0,
        total: 0
      }))
    );
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never purchased';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="text-center p-4">Loading products...</div>;
  }

  return (
    <div className="flex gap-4 overflow-hidden h-[calc(100vh-14rem)]">
      <div className="flex-[1.5]">
        <Table className="w-full border whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Last Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.ProductID}>
                <TableCell>
                  <div>
                    <div className="font-medium">{product.Name}</div>
                    {product.LastPurchaseDate && (
                      <div className="text-xs text-gray-500">
                        Last bought: {formatDate(product.LastPurchaseDate)}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {product.LastPurchasePrice > 0 ? (
                      <div>
                        <span className="font-medium">Rs. {Number(product.LastPurchasePrice).toFixed(2)}</span>
                        {(product.quantity ?? 0) > 0 && product.unitPrice !== product.LastPurchasePrice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-6 px-2 text-xs"
                            onClick={() => useLastPrice(product.ProductID)}
                          >
                            Use This
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">No history</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={product.quantity ?? ''}
                    onChange={(e) => handleQuantityChange(product.ProductID, e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.unitPrice ?? ''}
                    onChange={(e) => handleUnitPriceChange(product.ProductID, e.target.value)}
                    className="w-24"
                    placeholder={product.LastPurchasePrice > 0 ? Number(product.LastPurchasePrice).toFixed(2) : '0.00'}
                  />
                </TableCell>
                <TableCell>
                  {(product.total ?? 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex-1">
        <PurchasePaymentDetails
          total={calculateTotal()}
          items={selectedProducts.map(product => ({
            ProductID: product.ProductID,
            item: product.Name,
            quantity: product.quantity ?? 0,
            unitPrice: product.unitPrice ?? 0,
            total: product.total ?? 0
          }))}
          vendorID={parseInt(vendorId || '0')}
          invoiceNumber={invoiceNumber}
          invoiceDate={invoiceDate}
          onSuccess={() => {
            resetForm();
          }}
          onError={(error) => {
            toast({
              title: "Error",
              description: error,
              variant: "destructive",
            });
          }}
        />
      </div>
    </div>
  );
};

export default VendorProductsTable;