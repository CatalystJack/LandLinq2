import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Calculator, Info } from "lucide-react";
import { COLUMN_MAPPING } from "@/utils/formulaEvaluator";

interface FormulaBuilderProps {
  onAddFormula: (columnName: string, formula: string) => void;
  onClose: () => void;
  existingFormulas: {[key: string]: string};
  error: string;
}

export default function FormulaBuilder({ onAddFormula, onClose, existingFormulas, error }: FormulaBuilderProps) {
  const [columnName, setColumnName] = useState("");
  const [formula, setFormula] = useState("=");
  const [selectedFunction, setSelectedFunction] = useState("");

  const excelFunctions = [
    "SUM", "AVERAGE", "MAX", "MIN", "COUNT", "IF", "AND", "OR", "NOT", "ROUND", "ABS", "SQRT", "POWER",
    "CAP_RATE", "COST_PER_UNIT", "RENT_MULTIPLE", "NOI_MARGIN", "PRICE_PER_SF", "PRICE_PER_ACRE"
  ];

  const insertFunction = (funcName: string) => {
    const cursorPos = formula.length;
    const newFormula = formula.slice(0, cursorPos) + funcName + "()" + formula.slice(cursorPos);
    setFormula(newFormula);
  };

  const insertCellReference = (column: string) => {
    const cursorPos = formula.length;
    const newFormula = formula.slice(0, cursorPos) + column + formula.slice(cursorPos);
    setFormula(newFormula);
  };

  const handleSubmit = () => {
    if (!columnName.trim() || !formula.trim() || formula === "=") {
      return;
    }
    onAddFormula(columnName.trim(), formula);
    setColumnName("");
    setFormula("=");
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <CardTitle>Excel Formula Builder</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Column Name */}
        <div className="space-y-2">
          <Label htmlFor="column-name">Column Name</Label>
          <Input
            id="column-name"
            placeholder="e.g., ROI, Cost per SF, etc."
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            data-testid="input-formula-column-name"
          />
        </div>

        {/* Formula Input */}
        <div className="space-y-2">
          <Label htmlFor="formula">Formula</Label>
          <Textarea
            id="formula"
            placeholder="=SUM(C2:C10) or =IF(C2>1000000, 'High Value', 'Standard')"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="h-24 font-mono"
            data-testid="input-formula-expression"
          />
          {error && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <Info className="h-4 w-4" />
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Cell References */}
        <div className="space-y-3">
          <Label>Available Columns (Click to insert)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(COLUMN_MAPPING).map(([column, field]) => (
              <Button
                key={column}
                variant="outline"
                size="sm"
                onClick={() => insertCellReference(column + "1")}
                className="text-xs justify-start"
                data-testid={`button-insert-column-${column}`}
              >
                <span className="font-mono font-bold mr-1">{column}</span>
                <span className="truncate">{field.toString().replace('broker.', 'Broker ')}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Functions */}
        <div className="space-y-3">
          <Label>Excel Functions (Click to insert)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {excelFunctions.map((func) => (
              <Button
                key={func}
                variant="outline"
                size="sm"
                onClick={() => insertFunction(func)}
                className="text-xs font-mono"
                data-testid={`button-insert-function-${func}`}
              >
                {func}
              </Button>
            ))}
          </div>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <Label>Example Formulas</Label>
          <div className="grid gap-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <code className="text-sm text-gray-700">
                =CAP_RATE(Q1, C1) * 100
              </code>
              <p className="text-xs text-gray-500 mt-1">Calculate cap rate percentage</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <code className="text-sm text-gray-700">
                =IF(C1&gt;5000000, &quot;Premium&quot;, IF(C1&gt;1000000, &quot;Standard&quot;, &quot;Entry&quot;))
              </code>
              <p className="text-xs text-gray-500 mt-1">Classify deals by price tiers</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <code className="text-sm text-gray-700">
                =COST_PER_UNIT(C1, L1)
              </code>
              <p className="text-xs text-gray-500 mt-1">Calculate cost per unit</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <code className="text-sm text-gray-700">
                =ROUND(NOI_MARGIN(Q1, M1*12*L1), 2)
              </code>
              <p className="text-xs text-gray-500 mt-1">Calculate NOI margin as percentage</p>
            </div>
          </div>
        </div>

        {/* Existing Formulas */}
        {Object.keys(existingFormulas).length > 0 && (
          <div className="space-y-3">
            <Label>Current Custom Columns</Label>
            <div className="space-y-2">
              {Object.entries(existingFormulas).map(([name, formula]) => (
                <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium text-sm">{name}</span>
                    <code className="text-xs text-gray-600 ml-2">{formula}</code>
                  </div>
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!columnName.trim() || !formula.trim() || formula === "="}
            className="bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border-2 border-catalyst-gold hover:border-catalyst-gold transition-all duration-300"
            data-testid="button-add-formula"
          >
            Add Column
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}