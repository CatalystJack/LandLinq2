// Seed data for testing the analyst dashboard
import { apiRequest } from "./queryClient";

export async function seedTestData() {
  try {
    // Create a test broker first
    const broker = await apiRequest("POST", "/api/brokers", {
      firstName: "John",
      lastName: "Smith", 
      email: "john.smith@example.com",
      phone: "(888) 486-6346",
      marketsCovered: "Charlotte, Raleigh, Greensboro",
      brokerage: "Premier Real Estate",
      yearsExperience: "10+"
    });

    // Create several test deals
    const deals = [
      {
        brokerId: (broker as any).id,
        address: "123 Development Dr, Charlotte, NC",
        askingPrice: "2500000",
        sizeAcres: "5.2",
        zoning: "R-4",
        parcelId: "123456789",
        sewerAvailable: true,
        topRentPSF: "1850",
        brokerNotes: "Prime development location near major highways",
        submissionMethod: "form"
      },
      {
        brokerId: (broker as any).id,
        address: "456 Land Ave, Raleigh, NC", 
        askingPrice: "1200000",
        sizeAcres: "2.8",
        zoning: "R-2",
        parcelId: "987654321",
        sewerAvailable: false,
        topRentPSF: "1650",
        brokerNotes: "Needs sewer extension, otherwise good opportunity",
        submissionMethod: "email"
      },
      {
        brokerId: (broker as any).id,
        address: "789 Investment Rd, Greensboro, NC",
        askingPrice: "800000", 
        sizeAcres: "1.5",
        zoning: "Commercial",
        parcelId: "456789123",
        sewerAvailable: true,
        topRentPSF: "2100",
        brokerNotes: "Small lot but great location",
        submissionMethod: "sms"
      }
    ];

    for (const deal of deals) {
      await apiRequest("POST", "/api/deals", deal);
    }

    // console.log("Test data seeded successfully!");
  } catch (error) {
    // console.error("Error seeding test data:", error);
  }
}