import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, Paperclip, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  category: string | null;
  invoice_document_id: string | null;
  created_at: string;
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
}

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    category: "",
    invoice_document_id: "",
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [expensesResult, documentsResult] = await Promise.all([
        supabase.from("expenses").select("*").order("date", { ascending: false }),
        supabase.from("documents").select("id, file_name, file_path").eq("user_id", user.id),
      ]);

      if (expensesResult.error) throw expensesResult.error;

      setExpenses(expensesResult.data || []);
      setDocuments(documentsResult.data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expenseForm.amount || !expenseForm.date) {
      toast.error("Amount and date are required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let invoiceDocId = expenseForm.invoice_document_id;

      // Upload invoice file if provided
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split(".").pop();
        const fileName = `${user.id}/expenses/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(fileName, invoiceFile);

        if (uploadError) throw uploadError;

        const { data: docData, error: dbError } = await supabase
          .from("documents")
          .insert({
            client_id: null,
            user_id: user.id,
            file_name: invoiceFile.name,
            file_path: fileName,
            file_size: invoiceFile.size,
            file_type: invoiceFile.type,
            category: "Expense",
          })
          .select()
          .single();

        if (dbError) throw dbError;
        invoiceDocId = docData.id;
      }

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            amount: parseFloat(expenseForm.amount),
            description: expenseForm.description || null,
            date: expenseForm.date,
            category: expenseForm.category || null,
            invoice_document_id: invoiceDocId || null,
          })
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Expense updated successfully");
      } else {
        const { error } = await supabase.from("expenses").insert({
          user_id: user.id,
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description || null,
          date: expenseForm.date,
          category: expenseForm.category || null,
          invoice_document_id: invoiceDocId || null,
        });

        if (error) throw error;
        toast.success("Expense added successfully");
      }

      setDialogOpen(false);
      setEditingExpense(null);
      setInvoiceFile(null);
      setExpenseForm({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        category: "",
        invoice_document_id: "",
      });
      loadExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Failed to save expense");
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setInvoiceFile(null);
    setExpenseForm({
      amount: expense.amount.toString(),
      description: expense.description || "",
      date: expense.date,
      category: expense.category || "",
      invoice_document_id: expense.invoice_document_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;

      toast.success("Expense deleted successfully");
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  const handlePreviewDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    try {
      const { data } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.file_path, 3600);

      if (data?.signedUrl) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const fullUrl = data.signedUrl.startsWith('http')
          ? data.signedUrl
          : `${supabaseUrl}/storage/v1${data.signedUrl}`;

        setPreviewUrl(fullUrl);
        setPreviewDocument(doc);
      }
    } catch (error) {
      console.error("Error previewing document:", error);
      toast.error("Failed to preview document");
    }
  };

  const getInvoiceDocument = (invoiceId: string | null) => {
    if (!invoiceId) return null;
    return documents.find(doc => doc.id === invoiceId);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    })
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingExpense(null);
            setInvoiceFile(null);
            setExpenseForm({
              amount: "",
              description: "",
              date: new Date().toISOString().split('T')[0],
              category: "",
              invoice_document_id: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Attachment</Label>
                <div className="space-y-3">
                  <div className="border-2 border-dashed rounded-lg p-4">
                    <Label htmlFor="invoice_upload" className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {invoiceFile ? invoiceFile.name : "Click to upload invoice"}
                      </span>
                      <Input
                        id="invoice_upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setInvoiceFile(file);
                            setExpenseForm({ ...expenseForm, invoice_document_id: "" });
                          }
                        }}
                        className="hidden"
                      />
                    </Label>
                    {invoiceFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setInvoiceFile(null)}
                        className="w-full mt-2"
                      >
                        Clear file
                      </Button>
                    )}
                  </div>

                  {!invoiceFile && documents.length > 0 && (
                    <>
                      <div className="text-center text-sm text-muted-foreground">or</div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice_document">Select existing document</Label>
                        <Select
                          value={expenseForm.invoice_document_id || undefined}
                          onValueChange={(value) => setExpenseForm({ ...expenseForm, invoice_document_id: value })}
                          disabled={!!invoiceFile}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="No document selected" />
                          </SelectTrigger>
                          <SelectContent>
                            {documents.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.file_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90">
                {editingExpense ? "Update Expense" : "Add Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">${totalExpenses.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">${monthlyExpenses.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No expenses recorded yet</p>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => {
                const invoiceDoc = getInvoiceDocument(expense.invoice_document_id);
                return (
                  <div key={expense.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-lg text-destructive">${Number(expense.amount).toFixed(2)}</p>
                        {expense.category && (
                          <Badge variant="outline">{expense.category}</Badge>
                        )}
                      </div>
                      {expense.description && (
                        <p className="text-sm text-muted-foreground">{expense.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Date: {new Date(expense.date).toLocaleDateString()}
                      </p>
                      {invoiceDoc && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span className="truncate">Invoice: {invoiceDoc.file_name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(expense.invoice_document_id!);
                            }}
                            className="h-6 px-2"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 sm:flex-col">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(expense)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(expense.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDocument} onOpenChange={(open) => {
        if (!open) {
          setPreviewDocument(null);
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="truncate">{previewDocument?.file_name}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border rounded-lg"
                title="Document preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
