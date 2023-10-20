import acm.program.ConsoleProgram;

public class Pr27 extends ConsoleProgram{

	public void run(){
		
		int num1 = readInt("Enter Number N1: ");
		int num2 = readInt("Enter Number N2: ");
		
		int b = num1;
		
		for(int a = 0; a<num2-1; a++){
			
			num1 *= b;
			
		}
		
		println(num1);
		
	}
	
	
	
}
