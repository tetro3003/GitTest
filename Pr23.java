

import acm.program.ConsoleProgram;

public class Pr23 extends ConsoleProgram{
	
	public void run(){
		
		int num = readInt("Enter Number: ");
		int b = 0;  
		
		for(int c = num; c>0; c--){
			b += c;
		}
		
		println(b);
	}

}
