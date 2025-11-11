
export class Verification {
  id: string;
  data: VerificationData;
  timestamp: Date;
  type: "PSA" | "PHILSYS" | "VOTERS";
  status: "ERROR" | "AUTHENTIC" | "FAKE";
}


export class VerificationData {
  id?: string;
  sex?: string;
  name?: string;
  address?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  precintNo?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  votersIdNumber?: string;
}
