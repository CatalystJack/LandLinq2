import type { Deal, Broker } from "@shared/schema";

interface DealWithBroker extends Deal {
  broker: Broker;
}

// Column mapping for Excel-style references
const COLUMN_MAPPING: { [key: string]: keyof DealWithBroker | string } = {
  'A': 'classification',
  'B': 'address', 
  'C': 'askingPrice',
  'D': 'sizeAcres',
  'E': 'hasEntitlements',
  'F': 'sewerAvailable',
  'G': 'broker.firstName',
  'H': 'broker.email', 
  'I': 'broker.phone',
  'J': 'createdAt',
  'K': 'analystNotes',
  'L': 'unitCount',
  'M': 'topRentPSF',
  'N': 'constructionCostPerSF',
  'O': 'projectedRentPerSF',
  'P': 'totalProjectCost',
  'Q': 'projectedNOI',
  'R': 'marketCapRate',
  'S': 'developmentTimelineMonths',
  'T': 'unitSize'
};

// Reverse mapping for display
export const REVERSE_COLUMN_MAPPING: { [key: string]: string } = {};
Object.keys(COLUMN_MAPPING).forEach(key => {
  REVERSE_COLUMN_MAPPING[COLUMN_MAPPING[key]] = key;
});

// Excel functions
const EXCEL_FUNCTIONS: { [key: string]: (...args: any[]) => any } = {
  SUM: (...args: number[]) => args.reduce((sum, val) => sum + (Number(val) || 0), 0),
  AVERAGE: (...args: number[]) => {
    const nums = args.filter(val => !isNaN(Number(val))).map(Number);
    return nums.length > 0 ? nums.reduce((sum, val) => sum + val, 0) / nums.length : 0;
  },
  MAX: (...args: number[]) => Math.max(...args.map(Number).filter(val => !isNaN(val))),
  MIN: (...args: number[]) => Math.min(...args.map(Number).filter(val => !isNaN(val))),
  COUNT: (...args: any[]) => args.filter(val => val !== null && val !== undefined && val !== '').length,
  IF: (condition: any, trueValue: any, falseValue: any) => condition ? trueValue : falseValue,
  AND: (...args: any[]) => args.every(arg => Boolean(arg)),
  OR: (...args: any[]) => args.some(arg => Boolean(arg)),
  NOT: (arg: any) => !Boolean(arg),
  ROUND: (num: number, digits: number = 0) => Math.round(Number(num) * Math.pow(10, digits)) / Math.pow(10, digits),
  ABS: (num: number) => Math.abs(Number(num)),
  SQRT: (num: number) => Math.sqrt(Number(num)),
  POWER: (base: number, exponent: number) => Math.pow(Number(base), Number(exponent)),
  
  // Real estate specific functions
  CAP_RATE: (noi: number, price: number) => price ? (Number(noi) / Number(price)) * 100 : 0,
  COST_PER_UNIT: (totalCost: number, units: number) => units ? Number(totalCost) / Number(units) : 0,
  RENT_MULTIPLE: (price: number, annualRent: number) => annualRent ? Number(price) / Number(annualRent) : 0,
  NOI_MARGIN: (noi: number, grossIncome: number) => grossIncome ? (Number(noi) / Number(grossIncome)) * 100 : 0,
  PRICE_PER_SF: (price: number, sqft: number) => sqft ? Number(price) / Number(sqft) : 0,
  PRICE_PER_ACRE: (price: number, acres: number) => acres ? Number(price) / Number(acres) : 0,
};

// Get value from deal using column reference or nested property
function getCellValue(deal: DealWithBroker, columnOrPath: string): any {
  if (columnOrPath.includes('.')) {
    const parts = columnOrPath.split('.');
    let value: any = deal;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }
    return value;
  }
  return (deal as any)[columnOrPath];
}

// Parse cell reference (e.g., "A1", "C5") to get column and row
function parseCellReference(cellRef: string, deals: DealWithBroker[], currentIndex: number): any {
  const match = cellRef.match(/^([A-Z]+)(\d+|)$/);
  if (!match) return null;
  
  const [, column, rowStr] = match;
  const columnKey = COLUMN_MAPPING[column];
  if (!columnKey) return null;
  
  // If no row specified, use current row
  const rowIndex = rowStr ? parseInt(rowStr) - 1 : currentIndex;
  const targetDeal = deals[rowIndex];
  if (!targetDeal) return null;
  
  return getCellValue(targetDeal, columnKey);
}

// Tokenize formula into components
function tokenizeFormula(formula: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar) {
      inString = false;
      current += char;
    } else if (!inString && /[\+\-\*\/\(\)\,\<\>\=\!]/.test(char)) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
    } else if (!inString && char === ' ') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  return tokens;
}

// Evaluate formula expression
export function evaluateFormula(
  formula: string, 
  deals: DealWithBroker[], 
  currentIndex: number,
  calculatedFields: { [dealId: string]: { [fieldName: string]: any } } = {}
): any {
  try {
    // Remove leading = if present
    const cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
    
    // Simple value return
    if (/^-?\d+\.?\d*$/.test(cleanFormula)) {
      return parseFloat(cleanFormula);
    }
    
    if (cleanFormula.startsWith('"') && cleanFormula.endsWith('"')) {
      return cleanFormula.slice(1, -1);
    }
    
    // Tokenize the formula
    const tokens = tokenizeFormula(cleanFormula);
    
    // Process tokens and replace cell references
    const processedTokens = tokens.map(token => {
      // Check if it's a cell reference
      if (/^[A-Z]+\d*$/.test(token)) {
        const value = parseCellReference(token, deals, currentIndex);
        return value !== null ? value : 0;
      }
      
      // Check if it's a function
      if (token.toUpperCase() in EXCEL_FUNCTIONS) {
        return token.toUpperCase();
      }
      
      return token;
    });
    
    // Convert to evaluable JavaScript expression
    let expression = processedTokens.join(' ');
    
    // Handle Excel functions
    Object.keys(EXCEL_FUNCTIONS).forEach(funcName => {
      const regex = new RegExp(`${funcName}\\s*\\(([^)]+)\\)`, 'gi');
      expression = expression.replace(regex, (match, args) => {
        const argList = args.split(',').map((arg: string) => {
          const trimmedArg = arg.trim();
          // Handle cell ranges like A1:A10
          if (trimmedArg.includes(':')) {
            const [start, end] = trimmedArg.split(':');
            const startMatch = start.match(/^([A-Z]+)(\d+)$/);
            const endMatch = end.match(/^([A-Z]+)(\d+)$/);
            
            if (startMatch && endMatch) {
              const [, startCol, startRow] = startMatch;
              const [, endCol, endRow] = endMatch;
              
              if (startCol === endCol) {
                // Same column, different rows
                const values = [];
                for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
                  const value = parseCellReference(`${startCol}${row}`, deals, currentIndex);
                  if (value !== null) values.push(value);
                }
                return values.join(',');
              }
            }
          }
          
          // Handle single cell reference
          if (/^[A-Z]+\d*$/.test(trimmedArg)) {
            return parseCellReference(trimmedArg, deals, currentIndex) || 0;
          }
          
          return trimmedArg;
        });
        
        const func = EXCEL_FUNCTIONS[funcName];
        return func(...argList);
      });
    });
    
    // Replace Excel operators with JavaScript equivalents
    expression = expression.replace(/=/g, '==');
    expression = expression.replace(/<>/g, '!=');
    
    // Evaluate the final expression
    const result = Function('"use strict"; return (' + expression + ')')();
    return result;
    
  } catch (error) {
    // console.error('Formula evaluation error:', error);
    return '#ERROR';
  }
}

// Validate formula syntax
export function validateFormula(formula: string): { isValid: boolean; error?: string } {
  try {
    const cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of cleanFormula) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { isValid: false, error: 'Unbalanced parentheses' };
      }
    }
    
    if (parenCount !== 0) {
      return { isValid: false, error: 'Unbalanced parentheses' };
    }
    
    // Basic syntax checks
    if (cleanFormula.includes('..') || cleanFormula.includes('++') || cleanFormula.includes('--')) {
      return { isValid: false, error: 'Invalid syntax' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid formula syntax' };
  }
}

// Get all cell references from a formula
export function getFormulaDependencies(formula: string): string[] {
  const cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
  const dependencies: string[] = [];
  const regex = /[A-Z]+\d*/g;
  let match;
  
  while ((match = regex.exec(cleanFormula)) !== null) {
    if (COLUMN_MAPPING[match[0].replace(/\d+$/, '')]) {
      dependencies.push(match[0]);
    }
  }
  
  return Array.from(new Set(dependencies)); // Remove duplicates
}

export { COLUMN_MAPPING };