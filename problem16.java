

import acm.program.ConsoleProgram;

public class problem16 extends ConsoleProgram {
	
	public void run(){
	double firstNum = readDouble("Enter First Number: ");
	double secondNum = readDouble("Enter Second Number: ");
	
	double avg = (firstNum + secondNum) / 2;
	println(avg);

	}
}