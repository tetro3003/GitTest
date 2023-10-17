

import acm.program.ConsoleProgram;

public class Problem17 extends ConsoleProgram{
	
	public void run(){
		
		double userNum = readDouble("Enter Number: ");
		
		int num = (int)userNum;
		
		double num2 = userNum - num;
		
		println("Num1: " + num + "Num2: "+ num2);
		 
	}
	

}
