
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, FieldDefinition, StockOutRecord, User } from './types';
import { 
  pb, 
  getItems, saveItem, deleteItem, 
  getFields, createField, deleteField, 
  getStockOutRecords, createStockOutRecord, 
  logout 
} from './services/storageService';
import { Modal } from './components/Modal';

// --- Components ---

const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await pb.collection('users').authWithPassword(identity, password);
      onLogin();
    } catch (err: any) {
      console.error(err);
      setError('登录失败：账号或密码错误，或无法连接 PocketBase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">FlexInventory</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">企业级智能仓储管理</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号 / 邮箱</label>
            <input 
              type="text" 
              value={identity}
              onChange={e => setIdentity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-gray-400">
           请确保 PocketBase 后端服务已启动
        </div>
      </div>
    </div>
  );
};

// --- Entry Form ---
interface EntryFormProps {
  initialItem: Partial<InventoryItem> | null;
  fields: FieldDefinition[];
  existingNames: string[];
  role: 'manager' | 'warehouse';
  onSave: (item: Partial<InventoryItem>) => void;
  onCancel: () => void;
}

const EntryForm: React.FC<EntryFormProps> = ({ initialItem, fields, existingNames, role, onSave, onCancel }) => {
  const [name, setName] = useState(initialItem?.name || '');
  const [date, setDate] = useState(initialItem?.purchaseDate || new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(initialItem?.quantity?.toString() || '0');
  
  // Only managers handle price
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [unitPrice, setUnitPrice] = useState(initialItem?.price?.toString() || '0');
  const [totalPrice, setTotalPrice] = useState(
    initialItem && initialItem.quantity && initialItem.price 
      ? (initialItem.quantity * initialItem.price).toFixed(2) 
      : '0'
  );

  const [customValues, setCustomValues] = useState<Record<string, any>>(initialItem?.customValues || {});
  
  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (role === 'warehouse') return; // Warehouse doesn't need price calc
    const qty = parseFloat(quantity) || 0;
    if (priceMode === 'unit') {
      const unit = parseFloat(unitPrice) || 0;
      setTotalPrice((qty * unit).toFixed(2));
    } else {
      const total = parseFloat(totalPrice) || 0;
      setUnitPrice(qty > 0 ? (total / qty).toFixed(4) : '0');
    }
  }, [quantity, role]); // Add dependencies

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Price handlers
  const handleUnitChange = (val: string) => {
    setUnitPrice(val);
    if (priceMode === 'unit') {
       const qty = parseFloat(quantity) || 0;
       const unit = parseFloat(val) || 0;
       setTotalPrice((qty * unit).toFixed(2));
    }
  };

  const handleTotalChange = (val: string) => {
    setTotalPrice(val);
    if (priceMode === 'total') {
      const qty = parseFloat(quantity) || 0;
      const total = parseFloat(val) || 0;
      setUnitPrice(qty > 0 ? (total / qty).toFixed(4) : '0');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (val.trim()) {
      const filtered = existingNames.filter(n => n.toLowerCase().includes(val.toLowerCase()) && n !== val);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemToSave: Partial<InventoryItem> = {
      id: initialItem?.id,
      name,
      purchaseDate: date,
      quantity: parseFloat(quantity),
      price: role === 'manager' ? parseFloat(unitPrice) : (initialItem?.price || 0), // Warehouse preserves old price or 0
      customValues
    };
    onSave(itemToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 relative" ref={wrapperRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">物品名称</label>
          <input 
            required 
            value={name} 
            onChange={handleNameChange}
            onFocus={() => { if(name) setShowSuggestions(true); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {suggestions.map((s, idx) => (
                <li key={idx} onClick={() => selectSuggestion(s)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-700">{s}</li>
              ))}
            </ul>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">采购/入库日期</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
          <input type="number" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      {role === 'manager' && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">价格设置</label>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button type="button" onClick={() => setPriceMode('unit')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${priceMode === 'unit' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>按单价</button>
              <button type="button" onClick={() => setPriceMode('total')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${priceMode === 'total' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>按总价</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={priceMode === 'total' ? 'opacity-50' : ''}>
              <label className="block text-xs font-medium text-gray-500 mb-1">单价 (¥)</label>
              <input type="number" step="0.0001" required value={unitPrice} onChange={e => handleUnitChange(e.target.value)} readOnly={priceMode === 'total'} className={`w-full border rounded-lg px-3 py-2 outline-none ${priceMode === 'unit' ? 'border-blue-300 ring-2 ring-blue-100 bg-white' : 'border-gray-200 bg-gray-100'}`} />
            </div>
            <div className={priceMode === 'unit' ? 'opacity-50' : ''}>
              <label className="block text-xs font-medium text-gray-500 mb-1">总价 (¥)</label>
              <input type="number" step="0.01" required value={totalPrice} onChange={e => handleTotalChange(e.target.value)} readOnly={priceMode === 'unit'} className={`w-full border rounded-lg px-3 py-2 outline-none ${priceMode === 'total' ? 'border-blue-300 ring-2 ring-blue-100 bg-white' : 'border-gray-200 bg-gray-100'}`} />
            </div>
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">自定义属性</h4>
          <div className="grid grid-cols-2 gap-4">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.name}</label>
                <input 
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={customValues[field.id] || ''}
                  onChange={e => setCustomValues({...customValues, [field.id]: e.target.value})}
                  className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">保存</button>
      </div>
    </form>
  );
};

// --- StockOut Form (Unchanged UI, just props) ---
interface StockOutFormProps {
  existingNames: string[];
  onSave: (name: string, quantity: number, date: string) => void;
  onCancel: () => void;
}
const StockOutForm: React.FC<StockOutFormProps> = ({ existingNames, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (val.trim()) {
      setSuggestions(existingNames.filter(n => n.toLowerCase().includes(val.toLowerCase())));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingNames.includes(name)) return alert("请选择现有的库存物品进行出库");
    onSave(name, parseFloat(quantity), date);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-4 text-sm text-red-800">
        注意：出库操作将根据“先进先出”原则自动扣减最早批次的库存。
      </div>
      <div className="relative" ref={wrapperRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">出库物品</label>
        <input required value={name} onChange={handleNameChange} onFocus={() => {if(name) setShowSuggestions(true)}} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none" autoComplete="off" />
        {showSuggestions && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
            {suggestions.map((s, idx) => <li key={idx} onClick={() => {setName(s); setShowSuggestions(false)}} className="px-3 py-2 hover:bg-red-50 cursor-pointer text-gray-700">{s}</li>)}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">出库日期</label>
        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">出库数量</label>
        <input type="number" required min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
      </div>
      <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md">确认出库</button>
      </div>
    </form>
  );
};


// --- Main App ---

interface GroupedItemData {
  name: string;
  totalQuantity: number;
  totalValue: number;
  batchCount: number;
  batches: InventoryItem[];
  latestPrice: number;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(pb.authStore.model as any);
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stockOutRecords, setStockOutRecords] = useState<StockOutRecord[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [historyModalName, setHistoryModalName] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'inventory' | 'stockout'>('inventory');
  
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // Load Data on Mount or Login
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedFields, fetchedRecords] = await Promise.all([
        getItems(),
        getFields(),
        getStockOutRecords()
      ]);
      setItems(fetchedItems);
      setFields(fetchedFields);
      setStockOutRecords(fetchedRecords);
    } catch (e) {
      console.error("Load failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const isManager = currentUser?.role === 'manager';

  // --- Handlers ---

  const handleAddField = async (name: string, type: FieldDefinition['type']) => {
    if (!isManager) return alert("只有管理员可以修改字段设置");
    try {
      const newField = await createField({ id: '', name, type }); // ID assigned by PB
      setFields([...fields, newField as FieldDefinition]); // Simplify typing for demo
      // Reload fields to get true ID
      const updatedFields = await getFields();
      setFields(updatedFields);
    } catch(e) { alert("添加字段失败"); }
  };

  const handleRemoveField = async (id: string) => {
    if (!isManager) return alert("只有管理员可以修改字段设置");
    if (confirm('确定删除?')) {
      await deleteField(id);
      setFields(fields.filter(f => f.id !== id));
    }
  };

  const handleSaveItem = async (item: Partial<InventoryItem>) => {
    try {
      const result = await saveItem(item);
      await loadData(); // Reload all to ensure sync
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (e) {
      alert("保存失败，请检查网络或权限");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('确定删除?')) {
      await deleteItem(id);
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleStockOut = async (itemName: string, quantityToRemove: number, date: string) => {
    // FIFO Logic (Frontend Calculation with Backend Data)
    const batches = items
        .filter(i => i.name === itemName)
        .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    
    const totalAvail = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalAvail < quantityToRemove) return alert(`库存不足: ${totalAvail}`);

    let remaining = quantityToRemove;
    let cost = 0;
    
    // Optimistic Update steps
    try {
        for (const batch of batches) {
            if (remaining <= 0) break;        // 已经扣够了，后面的批次不需要动
            if (batch.quantity <= 0) continue; // 已经为0的历史批次保留，不参与扣减

            if (batch.quantity <= remaining) {
                // 整批扣完：不删除！把数量置 0 保留历史
                const used = batch.quantity;
                cost += used * batch.price;
                remaining -= used;
                await saveItem({ ...batch, quantity: 0 });
            } else {
                // 部分扣减：更新剩余数量
                const used = remaining;
                cost += used * batch.price;
                await saveItem({ ...batch, quantity: batch.quantity - used });
                remaining = 0;
            }
        }
        
        // Log Record
        await createStockOutRecord({
            id: '',
            name: itemName,
            quantity: quantityToRemove,
            totalCost: cost,
            date: date
        });

        await loadData();
        setIsStockOutModalOpen(false);
    } catch (e) {
        alert("出库过程中发生错误，建议刷新页面核对库存");
        loadData();
    }
  };

  const handleExportOverview = () => {
    const data = (Object.values(groupedItems) as GroupedItemData[]).sort((a, b) => b.totalQuantity - a.totalQuantity);
    
    const escapeCSV = (value: any) => {
        if (value === null || value === undefined) return "";
        let str = String(value);
        if (/^[=+\-@]/.test(str)) str = "'" + str;
        if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    // Columns dependent on Role
    let headers = ["物品名称", "总库存数量"];
    if (isManager) {
        headers.push("资产总值", "平均单价");
    }
    
    let csvContent = headers.map(escapeCSV).join(",") + "\n";

    data.forEach(row => {
      let rowData = [row.name, row.totalQuantity];
      if (isManager) {
        const avgPrice = row.totalQuantity > 0 ? (row.totalValue / row.totalQuantity).toFixed(4) : "0";
        rowData.push(row.totalValue.toFixed(2), avgPrice);
      }
      csvContent += rowData.map(escapeCSV).join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `库存_${isManager?'完整':'脱敏'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Derived State ---

  const groupedItems = useMemo<Record<string, GroupedItemData>>(() => {
    const groups: Record<string, GroupedItemData> = {};
    items.forEach(item => {
      if (!groups[item.name]) {
        groups[item.name] = { name: item.name, totalQuantity: 0, totalValue: 0, batchCount: 0, batches: [], latestPrice: 0 };
      }
      const g = groups[item.name];
      g.totalQuantity += item.quantity;
      // If user is warehouse, item.price might be 0 or hidden, but let's calculate logically
      // Note: If API returns price for warehouse user, we must ensure we don't display it.
      // Here we allow calculation but won't show it in UI for warehouse users.
      g.totalValue += (item.quantity * item.price);
      g.batchCount += 1;
      g.batches.push(item);
    });
    Object.values(groups).forEach(g => {
        g.batches.sort((a,b) => b.purchaseDate.localeCompare(a.purchaseDate));
        g.latestPrice = g.batches[0]?.price || 0;
    });
    return groups;
  }, [items]);

  const filteredGroups = useMemo(() => {
    return (Object.values(groupedItems) as GroupedItemData[]).filter(g => 
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.batches.some(b => Object.values(b.customValues).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [groupedItems, searchTerm]);

  const activeHistoryGroup = historyModalName ? groupedItems[historyModalName] : null;
  const activeStockOutRecords = useMemo(() => {
      if (!historyModalName) return [];
      return stockOutRecords.filter(r => r.name === historyModalName).sort((a,b) => b.date.localeCompare(a.date));
  }, [historyModalName, stockOutRecords]);

  // --- Render ---

  if (!currentUser) {
    return <LoginScreen onLogin={() => setCurrentUser(pb.authStore.model as any)} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
       {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col shadow-xl z-20">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">FlexInventory</h1>
          <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <p className="text-xs text-slate-400">{currentUser.name || currentUser.username} ({isManager ? '管理员' : '仓管员'})</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          <div className="mb-6 space-y-2">
             <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">核心功能</div>
             <button onClick={() => setIsOverviewModalOpen(true)} className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-left font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-900/50 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                仓库总件预览
              </button>
          </div>
          <div className="mb-6 space-y-2">
             <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">操作</div>
             <button onClick={() => { setEditingItem({}); setIsItemModalOpen(true); }} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-left font-medium transition flex items-center gap-2 shadow-lg shadow-blue-900/50 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                入库 / 登记
              </button>
             <button onClick={() => setIsStockOutModalOpen(true)} className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 rounded-lg text-left font-medium transition flex items-center gap-2 shadow-lg shadow-red-900/50 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                出库 / 领用
              </button>
          </div>
        </nav>

        <div className="pt-6 border-t border-slate-700 space-y-3">
           {isManager && (
             <button onClick={() => setIsFieldModalOpen(true)} className="text-sm text-slate-400 hover:text-white flex items-center gap-2 transition w-full">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
               系统设置
             </button>
           )}
           <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-2 transition w-full">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             退出登录
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50 relative">
        {loading && (
            <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )}
        
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
          <div className="relative w-96">
            <span className="absolute left-3 top-2.5 text-gray-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
            <input type="text" placeholder="搜索物品名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 outline-none transition" />
          </div>
          <div className="flex items-center text-sm text-gray-500">共 {filteredGroups.length} 种物品</div>
        </header>

        <div className="p-8 space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                    <th className="px-6 py-4">物品名称</th>
                    <th className="px-6 py-4 text-right">总库存数量</th>
                    {isManager && <th className="px-6 py-4 text-right">平均单价</th>}
                    {isManager && <th className="px-6 py-4 text-right">资产总值</th>}
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGroups.length === 0 ? (
                    <tr><td colSpan={isManager ? 5 : 3} className="px-6 py-12 text-center text-gray-400">暂无数据</td></tr>
                  ) : filteredGroups.map(group => (
                    <tr key={group.name} className="hover:bg-gray-50 transition group">
                      <td className="px-6 py-4 font-medium text-gray-900">{group.name}</td>
                      <td className="px-6 py-4 text-right font-bold">{group.totalQuantity}</td>
                      {isManager && <td className="px-6 py-4 text-right text-gray-600">¥{(group.totalQuantity > 0 ? group.totalValue / group.totalQuantity : 0).toFixed(2)}</td>}
                      {isManager && <td className="px-6 py-4 text-right font-medium text-green-600">¥{group.totalValue.toFixed(2)}</td>}
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => { setHistoryModalName(group.name); setHistoryTab('inventory'); }} className="text-gray-500 hover:text-blue-600 mr-3 text-sm font-medium">详情</button>
                        <button onClick={() => { setEditingItem({ name: group.name }); setIsItemModalOpen(true); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">补货</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={editingItem?.id ? "编辑记录" : "入库 / 补货"}>
        <EntryForm initialItem={editingItem} fields={fields} existingNames={Array.from(new Set(items.map(i => i.name)))} role={currentUser.role} onSave={handleSaveItem} onCancel={() => setIsItemModalOpen(false)} />
      </Modal>

      <Modal isOpen={isStockOutModalOpen} onClose={() => setIsStockOutModalOpen(false)} title="出库 / 领用">
        <StockOutForm existingNames={Array.from(new Set(items.map(i => i.name)))} onSave={handleStockOut} onCancel={() => setIsStockOutModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!historyModalName} onClose={() => setHistoryModalName(null)} title={`${historyModalName} - 详情`}>
        <div className="space-y-4">
           <div className="flex border-b border-gray-200 mb-4">
             <button onClick={() => setHistoryTab('inventory')} className={`px-4 py-2 text-sm font-medium ${historyTab === 'inventory' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>库存批次</button>
             <button onClick={() => setHistoryTab('stockout')} className={`px-4 py-2 text-sm font-medium ${historyTab === 'stockout' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>出库记录</button>
           </div>

           {historyTab === 'inventory' && activeHistoryGroup && (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">入库日期</th>
                    <th className="py-2 text-right">余量</th>
                    {isManager && <th className="py-2 text-right">单价</th>}
                    {isManager && <th className="py-2 text-right">总值</th>}
                    {fields.map(f => <th key={f.id} className="py-2 pl-4">{f.name}</th>)}
                    <th className="py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeHistoryGroup.batches.map(batch => (
                    <tr key={batch.id}>
                      <td className="py-3 text-gray-700">{batch.purchaseDate}</td>
                      <td className="py-3 text-right font-medium">{batch.quantity}</td>
                      {isManager && <td className="py-3 text-right text-gray-500">¥{batch.price}</td>}
                      {isManager && <td className="py-3 text-right text-gray-500">¥{(batch.quantity * batch.price).toFixed(2)}</td>}
                      {fields.map(f => <td key={f.id} className="py-3 pl-4 text-gray-500">{batch.customValues[f.id] || '-'}</td>)}
                      <td className="py-3 text-right">
                        <button onClick={() => { setEditingItem(batch); setHistoryModalName(null); setIsItemModalOpen(true); }} className="text-blue-600 hover:underline mr-2">编辑</button>
                        {isManager && <button onClick={() => handleDeleteItem(batch.id)} className="text-red-600 hover:underline">删除</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {historyTab === 'stockout' && (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">日期</th>
                    <th className="py-2 text-right">数量</th>
                    {isManager && <th className="py-2 text-right">成本 (FIFO)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeStockOutRecords.map(r => (
                    <tr key={r.id}>
                      <td className="py-3 text-gray-700">{r.date}</td>
                      <td className="py-3 text-right font-medium text-red-600">-{r.quantity}</td>
                      {isManager && <td className="py-3 text-right text-gray-500">¥{r.totalCost.toFixed(2)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
           )}
           <div className="flex justify-end pt-2"><button onClick={() => setHistoryModalName(null)} className="px-4 py-2 bg-gray-100 rounded text-gray-700">关闭</button></div>
        </div>
      </Modal>

      <Modal isOpen={isFieldModalOpen} onClose={() => setIsFieldModalOpen(false)} title="设置 (仅管理员)">
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
               <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleAddField(fd.get('fn') as string, fd.get('ft') as any); e.currentTarget.reset(); }} className="flex gap-2">
                 <input name="fn" placeholder="字段名 (如: 颜色)" required className="flex-1 border rounded px-3 py-2 text-sm" />
                 <select name="ft" className="border rounded px-3 py-2 text-sm"><option value="text">文本</option><option value="number">数字</option></select>
                 <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">添加</button>
               </form>
            </div>
            <div>
              {fields.map(f => (
                <div key={f.id} className="flex justify-between p-3 border-b">
                   <span>{f.name} <span className="text-xs text-gray-400">({f.type})</span></span>
                   <button onClick={() => handleRemoveField(f.id)} className="text-red-500 text-sm">删除</button>
                </div>
              ))}
            </div>
        </div>
      </Modal>
      
      <Modal isOpen={isOverviewModalOpen} onClose={() => setIsOverviewModalOpen(false)} title="库存总览">
        <div className="space-y-4">
           <div className="max-h-[60vh] overflow-y-auto border rounded">
              <table className="w-full text-sm text-left">
                 <thead className="bg-gray-100 sticky top-0">
                    <tr>
                       <th className="px-4 py-2">名称</th>
                       <th className="px-4 py-2 text-right">总数</th>
                       {isManager && <th className="px-4 py-2 text-right">总值</th>}
                    </tr>
                 </thead>
                 <tbody>
                    {(Object.values(groupedItems) as GroupedItemData[]).map(g => (
                       <tr key={g.name} className="border-t">
                          <td className="px-4 py-2">{g.name}</td>
                          <td className="px-4 py-2 text-right">{g.totalQuantity}</td>
                          {isManager && <td className="px-4 py-2 text-right">{g.totalValue.toFixed(2)}</td>}
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           <div className="flex justify-end gap-2">
              <button onClick={handleExportOverview} className="px-4 py-2 bg-green-600 text-white rounded">导出Excel</button>
              <button onClick={() => setIsOverviewModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">关闭</button>
           </div>
        </div>
      </Modal>

    </div>
  );
}
