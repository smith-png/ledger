import { BudgetLimit, CustomUpiRule, parseStatementText, Transaction } from './statementParser';

export const DEFAULT_CUSTOM_UPI_RULES: CustomUpiRule[] = [
  {
    id: 'rule-swapnil',
    pattern: 'swapnilkh',
    renameTo: 'Swapnil Khare',
    category: 'Food & Dining',
  },
  {
    id: 'rule-hunger',
    pattern: 'paytm-513',
    renameTo: 'HungerBox Canteen',
    category: 'Food & Dining',
  },
  {
    id: 'rule-rushikesh',
    pattern: 'rushikesh',
    renameTo: 'Rushikesh',
    category: 'People & Transfers',
  },
];

export interface StatementDataset {
  id: string;
  label: string;
  accountHolder: string;
  accountMasked: string;
  branchName: string;
  ifsc: string;
  periodLabel: string;
  fileName: string;
  fileFormat: 'PDF' | 'CSV' | 'XLS';
  rawCsv: string;
}

export const TANMAY_BOI_STATEMENT_CSV = `Sr No\tDate\tRemarks\tDebit\tCredit\tBalance
1\t15-10-2026\tUPI/110920995972/DR/Swapni/SBIN/swapnilkh/na\t35.00\t\t3812.39
2\t13-10-2026\tUPI/665226280290/DR/KASTUR/SBIN/899965410/UPI\t1650.00\t\t3847.39
3\t11-10-2026\tUPI/225107040528/CR/Karan/SBIN/957967665/NO REM\t\t79.00\t5497.39
4\t11-10-2026\tUPI/628470597676/DR/Amazon/RATN/amazonpay/Subscr\t78.20\t\t5418.39
5\t11-10-2026\tUPI/628474967236/CR/Pushka/SBIN/876646996/UPI\t\t500.00\t5496.59
6\t11-10-2026\tUPI/202135924188/DR/Swiggy/UTIB/swiggyupi/Pay fo\t100.00\t\t4996.59
7\t10-10-2026\tUPI/110886905533/DR/Swapni/SBIN/swapnilkh/na\t35.00\t\t5096.59
8\t10-10-2026\tUPI/192255012798/DR/FLIPKA/HDFC/flipkart./UPIInt\t2432.00\t\t5131.59
9\t10-10-2026\tUPI/131061472669/CR/TANMAY/BKID/pradiploh/UPI\t\t5000.00\t7563.59
10\t10-10-2026\tUPI/289067862836/CR/flipka/UTIB/flipkart./FLIPKA\t\t1835.00\t2563.59
11\t10-10-2026\tUPI/316590908619/CR/ARUN K/UCBA/976932746/Sent u\t\t90.00\t728.59
12\t10-10-2026\tUPI/628377540761/DR/Mr Ved/MAHB/897546784/UPI\t55.00\t\t638.59
13\t10-10-2026\tUPI/251406132836/CR/Google/UTIB/playstore/UPI\t\t2.00\t693.59
14\t10-10-2026\tUPI/251295582836/DR/Google/UTIB/playstore/Mandat\t2.00\t\t691.59
15\t10-10-2026\tUPI/250495782836/CR/ONE97/UTIB/poweracce/Paying\t\t1.00\t693.59
16\t10-10-2026\tUPI/628385649352/DR/MANGAL/BKID/pradiploh/Sent u\t44000.00\t\t692.59
17\t10-10-2026\tUPI/110883869400/DR/Mr VAI/CBIN/vaibhavch/na\t165.00\t\t44692.59
18\t10-10-2026\tUPI/224334782836/CR/ONE97/UTIB/poweracce/Paymen\t\t15.00\t44857.59
19\t10-10-2026\tUPI/628341711843/DR/Mr Ath/MAHB/badadeath/UPI\t150.00\t\t44842.59
20\t10-10-2026\tUPI/131030373475/CR/RUSHIK/SBIN/rushikesh/PAY BY\t\t60.00\t44992.59
21\t10-10-2026\tUPI/628327520278/DR/Amazon/RATN/amazonpay/Reques\t99.60\t\t44932.59
22\t09-10-2026\tUPI/185533797407/CR/Flipka/YESB/paytm-565/expres\t\t2252.00\t45032.19
23\t09-10-2026\tUPI/628277747715/DR/FLIPKA/HDFC/flipkart./UPIInt\t3670.00\t\t42780.19
24\t09-10-2026\tUPI/628233089414/CR/Mr VAI/CBIN/932280629/UPI\t\t2000.00\t46450.19
25\t09-10-2026\tUPI/181751949666/DR/Flipka/YESB/paytm-565/NO REM\t2262.00\t\t44450.19
26\t09-10-2026\tUPI/628288865140/CR/TANMAY/BKID/pradiploh/UPI\t\t30000.00\t46712.19
27\t08-10-2026\tUPI/628124830212/DR/Amazon/RATN/amazon@ra/Reques\t46703.00\t\t16712.19
28\t08-10-2026\tUPI/130925526628/CR/TANMAY/BKID/pradiploh/UPI\t\t60000.00\t63415.19
29\t08-10-2026\tUPI/664756796576/DR/Karan/SBIN/957967665/UPI\t200.00\t\t3415.19
30\t08-10-2026\tUPI/664754584157/DR/976932/UCBA/976932746/UPI\t2950.00\t\t3615.19
31\t08-10-2026\tUPI/664768296281/CR/TANMAY/BKID/pradiploh/educat\t\t5000.00\t6565.19
32\t08-10-2026\tUPI/628124207348/DR/Amazon/RATN/amazonpay/Reques\t804.00\t\t1565.19
33\t07-10-2026\tUPI/664622538232/CR/TANMAY/BKID/pradiploh/exam\t\t2000.00\t2369.19
34\t07-10-2026\tUPI/203056228100/CR/Karan/SBIN/957967665/NO REM\t\t200.00\t369.19
35\t05-10-2026\tUPI/627864383671/DR/Gaurav/SBIN/899918589/UPI\t20.00\t\t169.19
36\t04-10-2026\tUPI/185447498554/CR/Flipka/YESB/paytm-565/expres\t\t153.00\t189.19
37\t04-10-2026\tUPI/202226137825/DR/Flipka/YESB/paytm-565/NO REM\t224.00\t\t36.19
38\t30-09-2026\tUPI/663965675498/CR/ALOK A/UBIN/yalok5625/UPI\t\t112.00\t260.19
39\t30-09-2026\tUPI/663989868535/DR/Swiggy/UTIB/swiggy1on/UPI\t210.00\t\t148.19
40\t30-09-2026\tUPI/141125151915/DR/Amazon/RATN/amazonpay/You ar\t899.00\t\t358.19
41\t28-09-2026\tUPI/627130815908/DR/Flipka/YESB/paytm-565/UPI\t153.00\t\t1257.19
42\t28-09-2026\tUPI/663743599624/DR/Hunger/YESB/paytm-513/UPI\t15.00\t\t1410.19
43\t27-09-2026\tUPI/663627201603/DR/Hunger/YESB/paytm-513/UPI\t10.00\t\t1425.19
44\t27-09-2026\tUPI/663605836048/CR/VARAD/KKBK/842137073/UPI\t\t10.00\t1435.19
45\t26-09-2026\tUPI/626980710619/DR/Hunger/YESB/paytm-513/UPI\t10.00\t\t1425.19
46\t26-09-2026\tUPI/626922208757/DR/Hunger/YESB/paytm-513/UPI\t10.00\t\t1435.19
47\t26-09-2026\tUPI/663556633219/DR/Hunger/YESB/paytm-513/UPI\t10.00\t\t1445.19
48\t25-09-2026\tUPI/626845744478/DR/ANURAG/BKID/anuragbhe/UPI\t235.00\t\t1455.19
49\t24-09-2026\tUPI/626706862461/DR/Amazon/RATN/amazon@ra/Reques\t2354.40\t\t1690.19
50\t23-09-2026\tUPI/626606300393/DR/Amazon/RATN/amazonpay/Reques\t329.00\t\t4044.59
51\t23-09-2026\tUPI/130128190356/CR/TANMAY/BKID/pradiploh/UPI\t\t4000.00\t4373.59
52\t23-09-2026\tUPI/626606293766/CR/Amazon/YESB/amazonpay/Refund\t\t329.00\t373.59
53\t23-09-2026\tUPI/626606293766/DR/Amazon/YESB/amazonpay/Reques\t329.00\t\t44.59
54\t23-09-2026\tUPI/626607367718/DR/976932/UCBA/976932746/UPI\t60.00\t\t373.59
55\t17-09-2026\tUPI/195418064432/DR/Zomato/HDFC/zomato1pa/Zomato\t76.69\t\t433.59
56\t17-09-2026\tUPI/626017579460/DR/DR Raj/YESB/q36391930/UPI\t10.00\t\t510.28
57\t15-09-2026\tUPI/215746451100/CR/ARYANK/BARB/832984022/NO REM\t\t80.00\t520.28
58\t15-09-2026\tUPI/573668462586/CR/GOOGLE/UTIB/goog-paym/UPI\t\t1.00\t440.28
59\t15-09-2026\tUPI/662456324368/DR/ARYAN/BARB/burbandea/UPI\t100.00\t\t439.28
60\t15-09-2026\tUPI/662402522384/DR/ARUN K/UCBA/arunrsing/UPI\t30.00\t\t539.28
61\t15-09-2026\tUPI/625805150829/DR/SHUBHA/UNBA/bharatpe./Pay to\t40.00\t\t569.28
62\t15-09-2026\tUPI/625820133988/DR/Mrs VA/UNBA/bharatpe./Pay to\t15.00\t\t609.28`;

export const BOI_OCT_2026_CSV = `Sr No,Txn Date,Value Date,Description,Cheque No,Debit,Credit,Balance
1,01-10-2026,01-10-2026,BY TRANSFER-NEFT*HDFC0000240*NEXUS LABS INDIA PVT LTD*SALARY OCT 2026,,0.00,118500.00,164200.00
2,02-10-2026,02-10-2026,UPI/DR/627510293847/DESHMUKH PROPERTIES/HDFC/deshmukh.estates@okhdfcbank/Flat 402 House Rent,,26000.00,0.00,138200.00
3,03-10-2026,03-10-2026,ACH-DR-ZERODHA BROKINGICCL SIP-99201823,,15000.00,0.00,123200.00
4,04-10-2026,04-10-2026,UPI/DR/627719283746/RAHUL SHARMA/SBIN/rahul.sharma@oksbi/Weekend Goa Flight Advance,,6400.00,0.00,116800.00
5,05-10-2026,05-10-2026,UPI/CR/627811223344/PRIYA PATEL/ICIC/priya.patel@okicici/Shared Wi-Fi and Electricity Split,,0.00,2450.00,119250.00
6,05-10-2026,05-10-2026,UPI/DR/627899887766/NETFLIX COM/UTIB/netflix.bd@axisbank/UPI AutoPay Mandate,,649.00,0.00,118601.00
7,06-10-2026,06-10-2026,UPI/DR/627912345678/SWIGGY INDIA/YESB/swiggy@yespay/Dinner Order,,685.00,0.00,117916.00
8,07-10-2026,07-10-2026,UPI/DR/628023456789/D MART AVENUE SUPERMARTS/HDFC/dmart.powai@hdfcbank/Monthly Groceries,,4320.00,0.00,113596.00
9,08-10-2026,08-10-2026,UPI/CR/628134567890/RAHUL SHARMA/SBIN/rahul.sharma@oksbi/Hotel Booking Refund Share,,0.00,3900.00,117496.00
10,09-10-2026,09-10-2026,ACH-DR-TATA POWER MUMBAI ELECTRICITY-77182910,,2840.00,0.00,114656.00
11,10-10-2026,10-10-2026,UPI/DR/628345678901/JIOFIBER BROADBAND/JIOP/jiofiber@jio/Monthly Fiber Plan,,1178.00,0.00,113478.00
12,11-10-2026,11-10-2026,UPI/DR/628456789012/AMIT VERMA/KKBK/amit.verma94@okaxis/Cricket Turf Booking & Dinner,,1850.00,0.00,111628.00
13,12-10-2026,12-10-2026,UPI/DR/628567890123/ZOMATO LIMITED/ICIC/zomato@icici/Sunday Family Lunch,,1420.00,0.00,110208.00
14,13-10-2026,13-10-2026,UPI/DR/628678901234/SPOTIFY INDIA/UTIB/spotify.si@axisbank/Spotify Duo Mandate,,179.00,0.00,110029.00
15,14-10-2026,14-10-2026,UPI/DR/628789012345/UBER INDIA SYSTEMS/HDFC/uber.rides@hdfcbank/Airport Commute,,940.00,0.00,109089.00
16,15-10-2026,15-10-2026,UPI/CR/628890123456/NEHA KULKARNI/BARB/neha.kulkarni@okbaroda/Freelance UI Audit Settlement,,0.00,14500.00,123589.00
17,16-10-2026,16-10-2026,UPI/DR/628901234567/CULT FIT HEALTHCARE/ICIC/cultfit@icici/Monthly Pro Fitness Membership,,1999.00,0.00,121590.00
18,17-10-2026,17-10-2026,UPI/DR/629012345678/AMAZON PAY INDIA/UTIB/amazon@apl/Wireless Mechanical Keyboard & Stand,,5490.00,0.00,116100.00
19,18-10-2026,18-10-2026,UPI/DR/629123456789/ZEPTO KIRANAKART/YESB/zepto@yesbank/Fresh Fruits and Dairy,,890.00,0.00,115210.00
20,19-10-2026,19-10-2026,UPI/CR/629234567890/AMIT VERMA/KKBK/amit.verma94@okaxis/Turf Share Returned,,0.00,900.00,116110.00
21,20-10-2026,20-10-2026,UPI/DR/629345678901/HPCL HIGHWAY FUEL CENTER/SBIN/hpcl.bandra@sbi/Scooter & Car Petrol,,2350.00,0.00,113760.00
22,21-10-2026,21-10-2026,UPI/DR/629456789012/BLUE TOKAI COFFEE/HDFC/bluetokai@hdfcbank/Client Coffee Meeting,,560.00,0.00,113200.00
23,22-10-2026,22-10-2026,TO TRANSFER-IMPS/P2A/629567890123/ROHAN DESHMUKH/ICIC/Camera Lens Rental Deposit,,4500.00,0.00,108700.00
24,23-10-2026,23-10-2026,UPI/DR/629678901234/APPLE SERVICES/HDFC/apple.media@hdfcbank/iCloud 200GB Plan,,219.00,0.00,108481.00
25,24-10-2026,24-10-2026,UPI/DR/629789012345/SWIGGY INDIA/YESB/swiggy@yespay/Late Night Biryani & Dessert,,945.00,0.00,107536.00`;

export const SAMPLE_STATEMENTS: StatementDataset[] = [
  {
    id: 'tanmay-boi-statement',
    label: 'Tanmay P. Lohakar — BOI Detailed Statement',
    accountHolder: 'TANMAY PRADIP LOHAKAR',
    accountMasked: 'BOI A/c 875510110008696',
    branchName: 'BESA Branch, Nagpur',
    ifsc: 'BKID0008755',
    periodLabel: '15-09-2026 to 15-10-2026',
    fileName: 'Statement_1792062448031.PDF',
    fileFormat: 'PDF',
    rawCsv: TANMAY_BOI_STATEMENT_CSV,
  },
  {
    id: 'boi-oct-2026',
    label: 'Demo Salary & Rent — BOI Savings A/c',
    accountHolder: 'DEMO ACCOUNT HOLDER',
    accountMasked: 'BOI Savings •••• 4829',
    branchName: 'Mumbai — Bandra West Branch',
    ifsc: 'BKID0000042',
    periodLabel: '01 Oct 2026 – 24 Oct 2026',
    fileName: 'BOI_Savings_Statement_Oct2026.pdf',
    fileFormat: 'PDF',
    rawCsv: BOI_OCT_2026_CSV,
  },
];

export const DEFAULT_BUDGET_LIMITS: BudgetLimit[] = [
  { category: 'Shopping', monthlyLimit: 50000, alertThresholdPercent: 80 },
  { category: 'People & Transfers', monthlyLimit: 55000, alertThresholdPercent: 80 },
  { category: 'Food & Dining', monthlyLimit: 1000, alertThresholdPercent: 80 },
  { category: 'Subscriptions', monthlyLimit: 500, alertThresholdPercent: 80 },
  { category: 'Groceries', monthlyLimit: 5000, alertThresholdPercent: 80 },
  { category: 'Bills & Utilities', monthlyLimit: 4000, alertThresholdPercent: 80 },
  { category: 'Travel & Commute', monthlyLimit: 4000, alertThresholdPercent: 80 },
  { category: 'Rent & Housing', monthlyLimit: 26000, alertThresholdPercent: 90 },
  { category: 'Health & Fitness', monthlyLimit: 2500, alertThresholdPercent: 80 },
];

export function getInitialTransactions(): Transaction[] {
  return parseStatementText(TANMAY_BOI_STATEMENT_CSV);
}
