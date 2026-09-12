import bankDirectoryData from "@/data/bank-directory.json";

export interface DirectoryBank {
  code: string;
  name: string;
}

export interface DirectoryBranch {
  code: string;
  name: string;
}

export interface BankDirectory {
  banks: DirectoryBank[];
  branchesByBank: Record<string, DirectoryBranch[]>;
}

const directory = bankDirectoryData as BankDirectory;

/** LankaPay bank/branch directory bundled as JSON (no runtime xlsx). */
export async function loadBankDirectory(): Promise<BankDirectory> {
  return directory;
}
